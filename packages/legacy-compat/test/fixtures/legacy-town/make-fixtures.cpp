// Writes player.dat, config.dat and system.dat with the ORIGINAL server's own code
// (legacy/source/player_file.cpp, funeral_file.cpp, file_system.cpp, linked from the oracle's
// 32-bit objects) and prints what player_load() reads back.
#include "stdafx.h"
#include "funeral_file.h"
#include "file_system.h"
#include "player_file.h"
#include "funeral_util.h"
#include "online_struct.h"
#include <cstring>
#include <cstdlib>
void fq_set_clock(time_t t);
void fq_capture_response(struct tagREQUEST*, const char*) {}
void fq_log_line(const char* t) { fprintf(stderr, "[log] %s\n", t); }
#undef printf
extern online_global g_on;

static void put(char* dst, size_t n, const char* s) { memset(dst, 0, n); strncpy(dst, s, n - 1); }

static void mk(int i, const char* name, const char* logon, const char* pw, const char* parlor,
               const char* email, bool male, int money, int exp) {
  player_struct& p = p_play[i];
  memset(&p, 0, sizeof(p));
  p.i_index = i;
  put(p.st_name, 30, name); put(p.st_logon, 30, logon); put(p.st_password, 30, pw);
  put(p.st_funeral_name, 30, parlor); put(p.st_email, 50, email);
  p.b_active = true; p.b_male = male; p.b_want_email = (i == 0);
  p.last_ip.s_addr = 0x0100007f; p.old_ip.s_addr = 0x0201a8c0;
  p.t_last_logon = 1000000000 + i * 3600; p.t_last_packet = 1000000100 + i;
  p.i_turns = 7 + i; p.i_money = money; p.i_exp = exp; p.i_karma = 50 - i * 9; p.i_rating = 40 + i;
  p.a_coffins[0] = 5 + i; p.a_coffins[1] = 2; p.a_coffins[2] = i;
  p.i_transportation_type = i; p.i_plots = 3 * i; p.i_day_last_logged_on = 11 - i;
  p.i_sp = i * 4; p.i_luck = 50 + i; p.b_always = (i == 1); p.i_yangs_sent = i;
  p.i_psych = i; p.b_kicked_out_of_yangs = (i == 2);
  p.i_strength = 3 + i; p.i_hp_max = 10 + i; p.i_hp = 10; p.i_player_fights = i;
  p.b_can_be_attacked = true; p.b_police_protected = (i == 1);
  p.a_custom[C_CUSTOM_FIRE_ALARM] = 1; p.a_custom[C_CUSTOM_PADLOCK] = (i == 1);
  p.a_custom[C_CUSTOM_PADLOCK_STRENGTH] = 100 - i; p.a_custom[150] = 4242 + i;
  p.i_tags_recieved_today = i;
}

int main(int argc, char** argv) {
  fq_set_clock(1000000000);
  file_sys_load();   // no system.dat yet: defaults, then file_sys_save() (file_system.cpp:19-49)
  sys.i_max_players = 123; sys.i_inactive_days = 21; sys.b_maint_delete = false;
  sys.b_swear_filter = false; sys.i_max_online = 9; sys.i_port = 8080; sys.i_logons_total = 77;
  strcpy(sys.st_license_game_name, "Mort's Mortuary");
  file_sys_save();
  // file_config_load's defaults (funeral_file.cpp:20-52), which it sets before reading config.dat.
  glo.i_experience_per_day = 5; glo.i_starting_money = 500; glo.i_turns_per_day = 15;
  glo.i_starting_silver = 2; glo.i_starting_wood = 5; glo.i_starting_karma = 50;
  glo.i_starting_rating = 40; glo.i_starting_luck = 50; glo.i_yangs_per_day = 1; glo.i_risk = 50;
  glo.i_tourn_days = 30; glo.i_bonus_exp = 20; glo.i_bonus_luck = 25; glo.i_trade_bonus = 25;
  glo.i_visits_per_day = 2; glo.i_starting_hp = 10; glo.i_starting_strength = 3;
  strcpy(glo.st_admin_email, "(none)");
  glo.i_game_age = 42; glo.t_last_maint = 1000003600; glo.i_turns_per_day = 20;
  glo.i_starting_money = 750; glo.b_tourn_active = true; glo.i_tourn_days = 60; glo.i_risk = 40;
  glo.f_luck_odds = 0.1f; glo.f_normal_odds = 0.09f; glo.f_script_odds = 0.06f;
  glo.i_name_change_cost = 3; glo.i_tags_recievable_per_day = 2; glo.i_visits_per_day = 3;
  glo.a_casket_sp[0] = 1; glo.a_casket_sp[1] = 3; glo.a_casket_sp[2] = 6; glo.i_plot_sp = 2;
  glo.b_top_old_exists = true; strcpy(glo.st_top_old_name, "Mort"); glo.i_top_bp_old = 77;
  glo.i_top_index_old = 0; strcpy(glo.st_parlor_old, "Mort's Mortuary");
  strcpy(glo.st_news, "Welcome to the old town!"); strcpy(glo.st_admin_email, "sysop@example.org");
  strcpy(glo.a_st_rating[0], "Nobody"); strcpy(glo.a_st_karma[0], "Saint");
  file_config_save();
  g_on.i_cur_players = 4;
  p_play = (player_struct*)calloc(4, sizeof(player_struct));
  mk(0, "Mort", "mort", "hunter2", "Mort's Mortuary", "mort@example.org", true, 1500, 77);
  mk(1, "Ana", "ana", "p@ss word", "Ana's Rest", "", false, 20, 12);
  mk(2, "Ren\xe9" "e \x93Z\x94", "renee", "caf\xe9", "Caf\xe9 des Morts", "r@example.org", false, 99999, 5);
  mk(3, "Gone", "gone", "x", "Gone Parlor", "", true, 0, 0);
  p_play[3].b_active = false;
  player_save();    // player_file.cpp:92-131
  // Read it back with the original loader and show what it sees.
  free(p_play); p_play = NULL; g_on.i_cur_players = 0;
  bool ok = player_load();
  fprintf(stderr, "player_load ok=%d count=%d\n", (int)ok, g_on.i_cur_players);
  for (int i = 0; i < g_on.i_cur_players; i++) fprintf(stderr, "  %d %s money=%d exp=%d\n", i, p_play[i].st_name, p_play[i].i_money, p_play[i].i_exp);
  return 0;
}
