// File access for the oracle. The original runs from its install directory
// (server_init chdirs to the .exe's folder) and opens files by relative
// Windows paths such as "script\\stats.c" or "data\\mail\\3.dat".
//
//  - The virtual install directory is C:\fq\ (GetModuleFileName returns
//    C:\fq\fq.exe), so absolute paths built from GetExeDir() map back to it.
//  - Content files (the .txt tables and script\*.c that ship in legacy/dist)
//    are read from FQ_ORACLE_CONTENT, case-insensitively as on NTFS, unless a
//    copy exists in the scratch directory.
//  - Everything else, and every write, lives in FQ_ORACLE_SCRATCH, so the
//    original tree is never modified. Runtime files that happen to ship in
//    legacy/dist (log.txt, errorlog.txt, stats.txt, history.txt and deeds.txt,
//    the last holding the winners of Seth's own test server) are treated as
//    absent, as on a fresh install.
#include <dirent.h>

#include "fq_win32.h"

#undef fopen
#undef unlink
#undef remove
#undef rename
#undef chdir
#undef stat

namespace {

std::string env_or(const char* name, const char* fallback) {
  const char* v = getenv(name);
  return v && *v ? v : fallback;
}

std::string content_root() { return env_or("FQ_ORACLE_CONTENT", "."); }
std::string scratch_root() { return env_or("FQ_ORACLE_SCRATCH", "/tmp/fq-oracle-scratch"); }

bool is_content(const std::string& rel) {
  static const char* files[] = {"events.txt",       "hard_sell.txt",  "soft_sell.txt",
                                "karma.txt",        "ratings.txt",    "news_blurbs.txt",
                                "no_customers.txt", "risks.txt",      "swear_words.txt",
                                "yangs.txt",        "yangs_nice.txt", "ban.txt"};
  std::string lower = rel;
  for (char& c : lower) c = (char)tolower((unsigned char)c);
  if (lower.compare(0, 7, "script/") == 0) return true;
  for (const char* f : files)
    if (lower == f) return true;
  return false;
}

// The working directory, relative to the install directory ("" is C:\fq).
// delete_wildcard (all.cpp:1237) chdirs into a folder and unlinks by name.
std::string g_cwd;

std::string normalize_raw(const char* name);

/** Windows path -> path relative to the install directory, or absolute. */
std::string normalize(const char* name) {
  std::string p = name ? name : "";
  bool absolute = (p.size() >= 2 && p[1] == ':') || (!p.empty() && (p[0] == '/' || p[0] == '\\'));
  std::string out = normalize_raw(name);
  if (!absolute && !g_cwd.empty() && !out.empty()) out = g_cwd + "/" + out;
  return out;
}

std::string normalize_raw(const char* name) {
  std::string p = name ? name : "";
  for (char& c : p)
    if (c == '\\') c = '/';
  // Collapse doubled separators ("C:\fq\\script").
  std::string out;
  for (size_t i = 0; i < p.size(); i++) {
    if (p[i] == '/' && !out.empty() && out.back() == '/') continue;
    out.push_back(p[i]);
  }
  if (out.size() >= 6 && strncasecmp(out.c_str(), "c:/fq/", 6) == 0) return out.substr(6);
  if (strcasecmp(out.c_str(), "c:/fq") == 0) return "";
  if (out.size() >= 2 && out[1] == ':') return out.substr(2);  // another drive: best effort
  while (out.compare(0, 2, "./") == 0) out = out.substr(2);
  return out;
}

/** Resolves `rel` under `root` case-insensitively; returns "" when absent. */
std::string resolve_ci(const std::string& root, const std::string& rel) {
  std::string cur = root;
  size_t start = 0;
  while (start <= rel.size()) {
    size_t slash = rel.find('/', start);
    std::string part = rel.substr(start, slash == std::string::npos ? std::string::npos : slash - start);
    if (!part.empty()) {
      std::string exact = cur + "/" + part;
      struct stat st;
      if (stat(exact.c_str(), &st) == 0) {
        cur = exact;
      } else {
        DIR* d = opendir(cur.c_str());
        if (!d) return "";
        std::string found;
        while (dirent* e = readdir(d)) {
          if (strcasecmp(e->d_name, part.c_str()) == 0) {
            found = e->d_name;
            break;
          }
        }
        closedir(d);
        if (found.empty()) return "";
        cur += "/" + found;
      }
    }
    if (slash == std::string::npos) break;
    start = slash + 1;
  }
  return cur;
}

void mkdirs_for(const std::string& path) {
  size_t pos = 0;
  while ((pos = path.find('/', pos + 1)) != std::string::npos) {
    std::string dir = path.substr(0, pos);
    mkdir(dir.c_str(), 0777);
  }
}

/** Where a write to `rel` goes (an existing case variant, or the name as given). */
std::string scratch_target(const std::string& rel) {
  std::string found = resolve_ci(scratch_root(), rel);
  if (!found.empty()) return found;
  std::string path = scratch_root() + "/" + rel;
  mkdirs_for(path);
  return path;
}

std::string read_target(const std::string& rel) {
  std::string found = resolve_ci(scratch_root(), rel);
  if (!found.empty()) return found;
  if (is_content(rel)) return resolve_ci(content_root(), rel);
  return "";
}

}  // namespace

std::string fq_resolve_for_read(const char* name) {
  std::string rel = normalize(name);
  if (!rel.empty() && rel[0] == '/') return rel;
  return read_target(rel);
}

FILE* fq_fopen(const char* name, const char* mode) {
  std::string rel = normalize(name);
  if (!rel.empty() && rel[0] == '/') return fopen(rel.c_str(), mode);
  std::string m = mode;
  m.erase(std::remove(m.begin(), m.end(), 't'), m.end());
  bool writes = m.find('w') != std::string::npos || m.find('a') != std::string::npos ||
                m.find('+') != std::string::npos;
  if (!writes) {
    std::string path = read_target(rel);
    if (path.empty()) {
      errno = ENOENT;
      return 0;
    }
    return fopen(path.c_str(), m.c_str());
  }
  std::string target = scratch_target(rel);
  if (m.find('w') == std::string::npos && access(target.c_str(), F_OK) != 0 && is_content(rel)) {
    // Appending to or updating a content file: start from the original.
    std::string src = resolve_ci(content_root(), rel);
    if (!src.empty()) {
      FILE* in = fopen(src.c_str(), "rb");
      FILE* out = fopen(target.c_str(), "wb");
      if (in && out) {
        char buf[4096];
        size_t n;
        while ((n = fread(buf, 1, sizeof buf, in)) > 0) fwrite(buf, 1, n, out);
      }
      if (in) fclose(in);
      if (out) fclose(out);
    }
  }
  return fopen(target.c_str(), m.c_str());
}

int fq_unlink(const char* name) {
  std::string rel = normalize(name);
  if (!rel.empty() && rel[0] == '/') return unlink(rel.c_str());
  std::string found = resolve_ci(scratch_root(), rel);
  if (found.empty()) {
    errno = ENOENT;
    return -1;
  }
  return unlink(found.c_str());
}
int fq_remove(const char* name) { return fq_unlink(name); }
int fq_rename(const char* a, const char* b) {
  std::string ra = normalize(a), rb = normalize(b);
  std::string from = resolve_ci(scratch_root(), ra);
  if (from.empty()) {
    errno = ENOENT;
    return -1;
  }
  return rename(from.c_str(), scratch_target(rb).c_str());
}
int fq_access(const char* name, int mode) {
  std::string path = fq_resolve_for_read(name);
  if (path.empty()) return -1;
  return access(path.c_str(), mode);
}
// server_init chdirs to the install directory (funeral.cpp:62); paths are
// relative to it. Other folders are tracked so relative names follow them.
int fq_chdir(const char* p) {
  std::string rel = normalize(p);
  while (!rel.empty() && rel.back() == '/') rel.pop_back();
  if (rel.empty()) {
    g_cwd.clear();
    return 0;
  }
  if (rel[0] == '/') return -1;
  if (resolve_ci(scratch_root(), rel).empty() && resolve_ci(content_root(), rel).empty()) {
    errno = ENOENT;
    return -1;
  }
  g_cwd = rel;
  return 0;
}
int _chdir(const char* p) { return fq_chdir(p); }
char* _getcwd(char* buf, int n) {
  if (!buf) buf = (char*)malloc(n > 0 ? n : 16);
  std::string w = "C:\\fq";
  if (!g_cwd.empty()) {
    w += "\\";
    for (char c : g_cwd) w.push_back(c == '/' ? '\\' : c);
  }
  snprintf(buf, n, "%s", w.c_str());
  return buf;
}

// FindFirstFile / FindNextFile over the scratch copy of a folder, with
// Windows wildcard matching (case-insensitive).
#include <fnmatch.h>
namespace {
struct FindState {
  std::vector<WIN32_FIND_DATA> hits;
  size_t next;
};
}  // namespace
HANDLE FindFirstFile(LPCSTR pattern, WIN32_FIND_DATA* fd) {
  std::string rel = normalize(pattern);
  std::string dir, mask = rel;
  size_t slash = rel.rfind('/');
  if (slash != std::string::npos) {
    dir = rel.substr(0, slash);
    mask = rel.substr(slash + 1);
  }
  std::string root = dir.empty() ? scratch_root() : resolve_ci(scratch_root(), dir);
  FindState* st = new FindState();
  st->next = 0;
  if (!root.empty()) {
    if (DIR* d = opendir(root.c_str())) {
      std::vector<std::string> names;
      while (dirent* e = readdir(d)) {
        if (!strcmp(e->d_name, ".") || !strcmp(e->d_name, "..")) continue;
        if (fnmatch(mask.c_str(), e->d_name, FNM_CASEFOLD) == 0) names.push_back(e->d_name);
      }
      closedir(d);
      std::sort(names.begin(), names.end());
      for (const std::string& n : names) {
        WIN32_FIND_DATA w;
        memset(&w, 0, sizeof w);
        struct ::stat sb;
        std::string full = root + "/" + n;
        if (::stat(full.c_str(), &sb) == 0 && S_ISDIR(sb.st_mode)) w.dwFileAttributes = FILE_ATTRIBUTE_DIRECTORY;
        snprintf(w.cFileName, sizeof w.cFileName, "%s", n.c_str());
        st->hits.push_back(w);
      }
    }
  }
  if (st->hits.empty()) {
    delete st;
    return INVALID_HANDLE_VALUE;
  }
  *fd = st->hits[st->next++];
  return (HANDLE)st;
}
BOOL FindNextFile(HANDLE h, WIN32_FIND_DATA* fd) {
  if (h == INVALID_HANDLE_VALUE || !h) return FALSE;
  FindState* st = (FindState*)h;
  if (st->next >= st->hits.size()) return FALSE;
  *fd = st->hits[st->next++];
  return TRUE;
}
BOOL FindClose(HANDLE h) {
  if (h != INVALID_HANDLE_VALUE && h) delete (FindState*)h;
  return TRUE;
}
int fq_mkdir(const char* p) {
  std::string target = scratch_root() + "/" + normalize(p);
  mkdirs_for(target + "/");
  return 0;
}

// stat() is used by exist() (all.cpp:584); route it through the same lookup.
extern "C" int fq_stat(const char* name, struct stat* st) {
  std::string path = fq_resolve_for_read(name);
  if (path.empty()) {
    errno = ENOENT;
    return -1;
  }
  return stat(path.c_str(), st);
}
