// fq-oracle: the original Funeral Quest server's game logic, driven from
// stdin. One command per line; one JSON object per line on stdout.
//
//   seed <mt> <crt>        seed the Mersenne Twister (g_random) and the MSVC
//                          rand(); the rand() seed is then locked, standing
//                          in for the wall-clock srand() calls
//   clock <unix seconds>   set the clock time() reads
//   init                   server_init() (funeral.cpp:48-117)
//   req <ip> <query>       one request.xp hit from client <ip> (a.b.c.d);
//                          <query> is the text after "request.xp?", URL-encoded
//                          as the Flash client sent it
//   drop <ip>              the client's connection times out
//                          (g_on.online_delete_guy, as the kick timer did)
//   midnight               move the clock to the next local midnight and run
//                          maint_time_check() (maint.cpp:418)
//   set <setting> <value>  change a Game Settings / system value, as the
//                          sysop's dialogs did (names as in the port's
//                          GameSettings: tournamentActive, tournamentDays...)
//   grant <i> <field> <n>  set a field of player i's record (test set-up:
//                          wood, silver, gold, luck, strength, turns, bp,
//                          fireAlarm, safe, padlock, lockpicks,
//                          padlockStrength, police, hpMax, visitsUsed)
//   state                  print the town
//   customers <seed> <n>   n customers; customer k is made right after
//                          seeding the twister with seed+k and rand() with
//                          crt_seed_for(seed+k) (a different value, so the two
//                          streams are not correlated)
//   peek                   next outputs of the twister (does not draw)
//   crt <n>                n values of the shim's rand() (draws them)
//   quit
//
// Every reply carries the generators' draw counts since the last `seed`.
#include <sstream>

#include "stdafx.h"
#include "CRandom.h"
#include "CScriptEngine.h"
#include "create_customer.h"
#include "fq_capture.h"
#include "funeral.h"
#include "globals.h"
#include "maint.h"

extern CRandom g_random;
void request_process(LPREQUEST lpReq, CString cst_request);
void fq_set_clock(time_t t);
time_t fq_get_clock();
void fq_ms_rand_seed_and_lock(unsigned int seed, bool lock);
unsigned long fq_ms_rand_draws();
int fq_ms_rand();

// ------------------------------------------------------------------ output
namespace {

std::vector<std::string> g_responses;
std::vector<std::string> g_log;
bool g_quiet_log = getenv("FQ_ORACLE_LOG") == nullptr;

std::string json_str(const char* s) {
  std::string out = "\"";
  for (const unsigned char* p = (const unsigned char*)s; *p; p++) {
    unsigned char c = *p;
    switch (c) {
      case '"':
        out += "\\\"";
        break;
      case '\\':
        out += "\\\\";
        break;
      case '\n':
        out += "\\n";
        break;
      case '\r':
        out += "\\r";
        break;
      case '\t':
        out += "\\t";
        break;
      default:
        if (c < 0x20 || c >= 0x7f) {
          // Bytes are Windows-1252 text; JSON gets the Latin-1 code point.
          char buf[8];
          snprintf(buf, sizeof buf, "\\u%04x", c);
          out += buf;
        } else {
          out.push_back((char)c);
        }
    }
  }
  return out + "\"";
}
std::string json_str(const std::string& s) { return json_str(s.c_str()); }

class Obj {
 public:
  Obj& num(const char* k, long long v) {
    key(k);
    body += std::to_string(v);
    return *this;
  }
  Obj& real(const char* k, double v) {
    key(k);
    char buf[64];
    snprintf(buf, sizeof buf, "%.9g", v);
    body += buf;
    return *this;
  }
  Obj& boolean(const char* k, bool v) {
    key(k);
    body += v ? "true" : "false";
    return *this;
  }
  Obj& str(const char* k, const std::string& v) {
    key(k);
    body += json_str(v);
    return *this;
  }
  Obj& raw(const char* k, const std::string& v) {
    key(k);
    body += v;
    return *this;
  }
  std::string done() const { return "{" + body + "}"; }

 private:
  void key(const char* k) {
    if (!body.empty()) body += ",";
    body += json_str(k);
    body += ":";
  }
  std::string body;
};

std::string arr(const std::vector<std::string>& items) {
  std::string out = "[";
  for (size_t i = 0; i < items.size(); i++) {
    if (i) out += ",";
    out += items[i];
  }
  return out + "]";
}

// ------------------------------------------------------- generator positions
// CRandom keeps its state private; a copy of the object is a copy of the
// generator, so a shadow copy seeded alike is stepped forward until it equals
// g_random. That gives the number of draws without changing the original.
struct MtShadow {
  CRandom gen;
  unsigned seed = 4357;
  long long draws = 0;
  bool valid = true;
};
MtShadow g_shadow;

bool same_state(const CRandom& a, const CRandom& b) { return memcmp(&a, &b, sizeof(CRandom)) == 0; }

long long mt_draws() {
  if (!g_shadow.valid) return -1;
  for (long long guard = 0; guard < 5000000; guard++) {
    if (same_state(g_shadow.gen, g_random)) return g_shadow.draws;
    g_shadow.gen.Random(0xffffffffu);
    g_shadow.draws++;
  }
  g_shadow.valid = false;  // reseeded behind our back
  return -1;
}

void reseed(unsigned mt, unsigned crt) {
  g_random.SetRandomSeed(mt);
  g_shadow.gen = g_random;
  g_shadow.seed = mt;
  g_shadow.draws = 0;
  g_shadow.valid = true;
  fq_ms_rand_seed_and_lock(crt, true);
}

std::string rng_json() {
  Obj o;
  o.num("mt", mt_draws());
  o.num("crt", (long long)fq_ms_rand_draws());
  return o.done();
}

// --------------------------------------------------------------- dumps
std::string ip_of(const in_addr& a) {
  char buf[32];
  snprintf(buf, sizeof buf, "%u.%u.%u.%u", a.S_un.S_un_b.s_b1, a.S_un.S_un_b.s_b2, a.S_un.S_un_b.s_b3,
           a.S_un.S_un_b.s_b4);
  return buf;
}

std::string status_json(const communication_status& s) {
  Obj o;
  o.boolean("active", s.b_customer_active)
      .boolean("customerMale", s.b_customer_sex_male)
      .num("customerAge", s.i_customer_age)
      .boolean("deceasedMale", s.b_deceased_sex_male)
      .num("deceasedAge", s.i_deceased_age)
      .num("relation", s.e_relation)
      .num("income", s.e_income)
      .num("desiredCasket", s.e_desired_casket)
      .num("bigUpgrade", s.e_big_upgrade)
      .num("deathType", s.e_death_type)
      .num("deathObject", s.e_death_object)
      .num("price", s.i_price)
      .num("moneyToSpend", s.i_money_to_spend)
      .num("specialButton", s.i_special_button)
      .real("mood", s.f_mood)
      .real("cheapness", s.f_cheapness)
      .boolean("loved", s.b_loved)
      .num("riskType", s.i_risk_type)
      .str("urlSave", s.st_url_save)
      .boolean("showResistance", s.b_show_resistance)
      .num("locationCallback", s.i_location_callback)
      .num("hisId", s.i_his_id)
      .num("playTarget", s.p_play ? s.p_play->i_index : -1)
      .boolean("locked", s.b_locked);
  return o.done();
}

std::string queue_json(online_struct* on) {
  std::vector<std::string> items;
  class_que_packet* p = nullptr;
  if (on->que.get_reference_to_first(&p)) {
    for (; p; p = p->next) {
      Obj o;
      o.num("type", p->q.c_type)
          .num("importance", p->q.c_importance)
          .num("from", p->q.i_from)
          .num("value", p->q.i_value)
          .num("subType", p->q.i_sub_type)
          .num("expire", p->q.i_expire)
          .str("text", p->text ? p->text : "");
      items.push_back(o.done());
    }
  }
  return arr(items);
}

std::string player_json(int i) {
  player_struct& p = p_play[i];
  Obj o;
  o.num("index", i)
      .str("name", p.st_name)
      .str("logon", p.st_logon)
      .str("parlor", p.st_funeral_name)
      .str("email", p.st_email)
      .boolean("active", p.b_active)
      .boolean("male", p.b_male)
      .boolean("online", p.p_on != NULL)
      .num("turns", p.i_turns)
      .num("money", p.i_money)
      .num("exp", p.i_exp)
      .num("karma", p.i_karma)
      .num("rating", p.i_rating)
      .raw("tags", "[" + std::to_string(p.a_coffins[0]) + "," + std::to_string(p.a_coffins[1]) + "," +
                       std::to_string(p.a_coffins[2]) + "]")
      .num("transportation", p.i_transportation_type)
      .num("plots", p.i_plots)
      .num("dayLastLoggedOn", p.i_day_last_logged_on)
      .num("sp", p.i_sp)
      .num("luck", p.i_luck)
      .num("yangsSent", p.i_yangs_sent)
      .num("psych", p.i_psych)
      .boolean("kickedOutOfYangs", p.b_kicked_out_of_yangs)
      .num("strength", p.i_strength)
      .num("hpMax", p.i_hp_max)
      .num("hp", p.i_hp)
      .num("playerFights", p.i_player_fights)
      .boolean("canBeAttacked", p.b_can_be_attacked)
      .boolean("policeProtected", p.b_police_protected)
      .num("tagsReceivedToday", p.i_tags_recieved_today);
  std::vector<std::string> custom;
  for (int k = 0; k < 10; k++) custom.push_back(std::to_string(p.a_custom[k]));
  o.raw("custom", arr(custom));
  if (p.p_on) {
    online_struct* on = p.p_on;
    Obj s;
    s.num("status", on->i_status)
        .str("location", (LPCSTR)on->cst_location)
        .num("script", on->m_i_script)
        .raw("customer", status_json(on->status))
        .raw("queue", queue_json(on));
    std::vector<std::string> opts;
    for (int k = 0; k < on->a_options.GetSize(); k++) opts.push_back(std::to_string(on->a_options[k]));
    s.raw("options", arr(opts));
    o.raw("session", s.done());
  }
  return o.done();
}

std::string town_json() {
  Obj g;
  g.num("day", glo.i_game_age)
      .boolean("topOldExists", glo.b_top_old_exists)
      .str("topOldName", glo.st_top_old_name)
      .num("topOldBp", glo.i_top_bp_old)
      .num("topOldIndex", glo.i_top_index_old)
      .str("topOldParlor", glo.st_parlor_old)
      .boolean("tournament", glo.b_tourn_active)
      .num("tournamentDays", glo.i_tourn_days)
      .num("turnsPerDay", glo.i_turns_per_day)
      .num("lastMaint", (long long)glo.t_last_maint);
  std::vector<std::string> players;
  for (int i = 0; i < g_on.i_cur_players; i++) players.push_back(player_json(i));
  g.raw("players", arr(players));
  return g.done();
}

// ----------------------------------------------------------- requests
std::map<std::string, REQUEST*> g_requests;
std::map<std::string, SOCKADDR_IN*> g_addrs;

REQUEST* request_for(const std::string& ip) {
  auto it = g_requests.find(ip);
  if (it != g_requests.end()) return it->second;
  SOCKADDR_IN* addr = (SOCKADDR_IN*)calloc(1, sizeof(SOCKADDR_IN));
  addr->sin_family = AF_INET;
  addr->sin_addr.S_un.S_addr = inet_addr(ip.c_str());
  REQUEST* r = (REQUEST*)calloc(1, sizeof(REQUEST));
  r->lpSockAddr = (LPSOCKADDR)addr;
  r->nAddrLen = sizeof(SOCKADDR_IN);
  r->Socket = (SOCKET)(g_requests.size() + 100);
  r->i_on_index = -1;
  g_requests[ip] = r;
  g_addrs[ip] = addr;
  return r;
}

int online_index_of(const std::string& ip) {
  unsigned long a = inet_addr(ip.c_str());
  for (int i = 0; i < g_on.i_cur_people; i++)
    if (p_on[i] && p_on[i]->ip.S_un.S_addr == a) return i;
  return -1;
}

void reply(const char* op, Obj& o) {
  o.str("op", op);
  o.raw("responses", [] {
    std::vector<std::string> r;
    for (auto& s : g_responses) r.push_back(json_str(s));
    return arr(r);
  }());
  if (!g_log.empty()) {
    std::vector<std::string> l;
    for (auto& s : g_log) l.push_back(json_str(s));
    o.raw("log", arr(l));
  }
  o.raw("rng", rng_json());
  fputs(o.done().c_str(), stdout);
  fputc('\n', stdout);
  fflush(stdout);
  g_responses.clear();
  g_log.clear();
}

// Next local midnight after `t` (the clock is in the TZ of the process).
time_t next_midnight(time_t t) {
  struct tm v;
  localtime_r(&t, &v);
  v.tm_mday += 1;
  v.tm_hour = 0;
  v.tm_min = 0;
  v.tm_sec = 1;
  v.tm_isdst = -1;
  return mktime(&v);
}

unsigned crt_seed_for(unsigned s) { return (s * 2654435761u) ^ 0x5bd1e995u; }

bool set_setting(const std::string& key, const std::string& value) {
  int i = atoi(value.c_str());
  float f = (float)atof(value.c_str());
  if (key == "tournamentActive") glo.b_tourn_active = i != 0;
  else if (key == "tournamentDays") glo.i_tourn_days = i;
  else if (key == "turnsPerDay") glo.i_turns_per_day = i;
  else if (key == "visitsPerDay") glo.i_visits_per_day = i;
  else if (key == "yangsPerDay") glo.i_yangs_per_day = i;
  else if (key == "risk") glo.i_risk = i;
  else if (key == "normalOdds") glo.f_normal_odds = f;
  else if (key == "luckOdds") glo.f_luck_odds = f;
  else if (key == "scriptOdds") glo.f_script_odds = f;
  else if (key == "tagsReceivablePerDay") glo.i_tags_recievable_per_day = i;
  else if (key == "nameChangeCost") glo.i_name_change_cost = i;
  else if (key == "maintDelete") sys.b_maint_delete = i != 0;
  else if (key == "inactiveDays") sys.i_inactive_days = i;
  else if (key == "swearFilter") sys.b_swear_filter = i != 0;
  else return false;
  return true;
}

bool grant(int i, const std::string& field, int v) {
  if (i < 0 || i >= g_on.i_cur_players) return false;
  player_struct& p = p_play[i];
  if (field == "wood") p.a_coffins[c_coffin_wood] = v;
  else if (field == "silver") p.a_coffins[c_coffin_silver] = v;
  else if (field == "gold") p.a_coffins[c_coffin_gold] = v;
  else if (field == "luck") p.i_luck = v;
  else if (field == "strength") p.i_strength = v;
  else if (field == "turns") p.i_turns = v;
  else if (field == "bp") p.i_exp = v;
  else if (field == "fireAlarm") p.a_custom[C_CUSTOM_FIRE_ALARM] = v;
  else if (field == "safe") p.a_custom[C_CUSTOM_SAFE] = v;
  else if (field == "padlock") p.a_custom[C_CUSTOM_PADLOCK] = v;
  else if (field == "lockpicks") p.a_custom[C_CUSTOM_LOCKPICK] = v;
  else if (field == "padlockStrength") p.a_custom[C_CUSTOM_PADLOCK_STRENGTH] = v;
  else if (field == "police") p.b_police_protected = v != 0;
  else if (field == "hpMax") p.i_hp_max = p.i_hp = v;
  else if (field == "visitsUsed") p.i_player_fights = v;
  else return false;
  return true;
}

void customers(unsigned seed, int count) {
  // One online slot, as a client at 10.255.255.255 would get.
  REQUEST* r = request_for("10.255.255.255");
  int idx = online_index_of("10.255.255.255");
  if (idx == -1) idx = g_on.create_new(r);
  r->i_on_index = idx;
  online_struct* on = p_on[idx];
  for (int k = 0; k < count; k++) {
    reseed(seed + k, crt_seed_for(seed + k));
    create_random_customer(r);
    Obj o;
    o.num("seed", seed + k).raw("customer", status_json(on->status));
    o.str("mood", (LPCSTR)on->c_mood())
        .str("relation", (LPCSTR)on->d_relation())
        .str("man", (LPCSTR)on->c_man())
        .str("income", (LPCSTR)on->c_income())
        .str("casket", (LPCSTR)on->casket())
        .raw("rng", rng_json());
    fputs(o.done().c_str(), stdout);
    fputc('\n', stdout);
  }
  fflush(stdout);
}

}  // namespace

// ------------------------------------------------------------ shim hooks
void fq_capture_response(struct tagREQUEST*, const char* text) { g_responses.push_back(text); }
void fq_log_line(const char* text) {
  std::string line = text;
  while (!line.empty() && (line.back() == '\n' || line.back() == '\r')) line.pop_back();
  // Drop the "date time:" prefix LogMsg adds (funeral_util.cpp:146-180).
  g_log.push_back(line);
  if (!g_quiet_log) fprintf(stderr, "%s\n", line.c_str());
}

int main() {
  setvbuf(stdout, nullptr, _IOFBF, 1 << 20);
  std::string line;
  char buf[1 << 16];
  while (fgets(buf, sizeof buf, stdin)) {
    line = buf;
    while (!line.empty() && (line.back() == '\n' || line.back() == '\r')) line.pop_back();
    if (line.empty()) continue;
    std::istringstream in(line);
    std::string cmd;
    in >> cmd;
    Obj o;
    if (cmd == "seed") {
      unsigned mt = 0, crt = 0;
      in >> mt >> crt;
      reseed(mt, crt);
      reply("seed", o);
    } else if (cmd == "clock") {
      long long t = 0;
      in >> t;
      fq_set_clock((time_t)t);
      reply("clock", o);
    } else if (cmd == "init") {
      server_init();
      o.raw("town", town_json());
      reply("init", o);
    } else if (cmd == "req") {
      std::string ip, query;
      in >> ip;
      std::getline(in, query);
      if (!query.empty() && query[0] == ' ') query = query.substr(1);
      REQUEST* r = request_for(ip);
      request_process(r, CString("/request.xp?") + query.c_str());
      o.str("ip", ip).raw("town", town_json());
      reply("req", o);
    } else if (cmd == "drop") {
      std::string ip;
      in >> ip;
      int idx = online_index_of(ip);
      if (idx != -1) g_on.online_delete_guy(idx);
      o.str("ip", ip).boolean("found", idx != -1).raw("town", town_json());
      reply("drop", o);
    } else if (cmd == "midnight") {
      fq_set_clock(next_midnight(fq_get_clock()));
      maint_time_check();
      o.num("clock", (long long)fq_get_clock()).raw("town", town_json());
      reply("midnight", o);
    } else if (cmd == "set") {
      std::string key, value;
      in >> key >> value;
      if (!set_setting(key, value)) o.str("error", "unknown setting " + key);
      reply("set", o);
    } else if (cmd == "grant") {
      int i = 0, v = 0;
      std::string field;
      in >> i >> field >> v;
      if (!grant(i, field, v)) o.str("error", "cannot grant " + field);
      reply("grant", o);
    } else if (cmd == "state") {
      o.raw("town", town_json());
      reply("state", o);
    } else if (cmd == "customers") {
      unsigned seed = 0;
      int count = 0;
      in >> seed >> count;
      customers(seed, count);
    } else if (cmd == "peek") {
      CRandom copy = g_random;
      std::vector<std::string> mt;
      for (int k = 0; k < 4; k++) mt.push_back(std::to_string(copy.Random(0xffffffffu)));
      o.raw("nextMt", arr(mt));
      reply("peek", o);
    } else if (cmd == "crt") {
      int n = 0;
      in >> n;
      std::vector<std::string> v;
      for (int k = 0; k < n; k++) v.push_back(std::to_string(fq_ms_rand()));
      o.raw("values", arr(v));
      reply("crt", o);
    } else if (cmd == "quit") {
      break;
    } else {
      o.str("error", "unknown command " + cmd);
      reply("error", o);
    }
  }
  return 0;
}
