// Win32 and Microsoft C runtime functions for the oracle shim.
#include "fq_win32.h"

#undef rand
#undef srand
#undef time

// ------------------------------------------------------------------ clock
// The harness sets the clock (fq_set_clock); nothing reads the real time.
static time_t g_fq_clock = 978307200;  // 2001-01-01 00:00:00 UTC
static unsigned long g_fq_ticks = 0;

void fq_set_clock(time_t t) { g_fq_clock = t; }
time_t fq_get_clock() { return g_fq_clock; }
time_t fq_time(time_t* t) {
  if (t) *t = g_fq_clock;
  return g_fq_clock;
}
DWORD GetTickCount() { return (DWORD)(g_fq_ticks += 16); }
DWORD timeGetTime() { return GetTickCount(); }
void Sleep(DWORD) {}
BOOL QueryPerformanceCounter(LARGE_INTEGER* li) {
  li->QuadPart = (LONGLONG)GetTickCount() * 1000;
  return TRUE;
}
BOOL QueryPerformanceFrequency(LARGE_INTEGER* li) {
  li->QuadPart = 1000000;
  return TRUE;
}
static void to_systemtime(time_t t, SYSTEMTIME* st) {
  struct tm tmv;
  localtime_r(&t, &tmv);
  st->wYear = (WORD)(tmv.tm_year + 1900);
  st->wMonth = (WORD)(tmv.tm_mon + 1);
  st->wDayOfWeek = (WORD)tmv.tm_wday;
  st->wDay = (WORD)tmv.tm_mday;
  st->wHour = (WORD)tmv.tm_hour;
  st->wMinute = (WORD)tmv.tm_min;
  st->wSecond = (WORD)tmv.tm_sec;
  st->wMilliseconds = 0;
}
void GetLocalTime(SYSTEMTIME* st) { to_systemtime(g_fq_clock, st); }
void GetSystemTime(SYSTEMTIME* st) { to_systemtime(g_fq_clock, st); }
// GetDateFormat / GetTimeFormat with a picture string, as Windows reads it for
// the en-US locale: d dd ddd dddd, M MM MMM MMMM, y yy yyyy, h hh H HH, m mm,
// s ss, t tt, and 'quoted' literals (a quote with no closing quote runs to the
// end). show_time() uses "h':'mm' 'tt" (std_all.cpp:328-347), so broadcast()
// prefixes notices with, for example, "12:05 AM".
static const char* kDays[] = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
static const char* kMonths[] = {"January", "February", "March",     "April",   "May",      "June",
                                "July",    "August",   "September", "October", "November", "December"};
static std::string picture_format(const char* pic, const SYSTEMTIME& st) {
  std::string out;
  const char* p = pic;
  char buf[32];
  while (*p) {
    char c = *p;
    if (c == '\'') {
      p++;
      while (*p && *p != '\'') out.push_back(*p++);
      if (*p) p++;
      continue;
    }
    int n = 0;
    while (p[n] == c) n++;
    switch (c) {
      case 'd':
        if (n == 1) snprintf(buf, sizeof buf, "%u", st.wDay);
        else if (n == 2) snprintf(buf, sizeof buf, "%02u", st.wDay);
        else if (n == 3) snprintf(buf, sizeof buf, "%.3s", kDays[st.wDayOfWeek]);
        else snprintf(buf, sizeof buf, "%s", kDays[st.wDayOfWeek]);
        out += buf;
        break;
      case 'M':
        if (n == 1) snprintf(buf, sizeof buf, "%u", st.wMonth);
        else if (n == 2) snprintf(buf, sizeof buf, "%02u", st.wMonth);
        else if (n == 3) snprintf(buf, sizeof buf, "%.3s", kMonths[st.wMonth - 1]);
        else snprintf(buf, sizeof buf, "%s", kMonths[st.wMonth - 1]);
        out += buf;
        break;
      case 'y':
        if (n <= 2) snprintf(buf, sizeof buf, n == 1 ? "%u" : "%02u", st.wYear % 100);
        else snprintf(buf, sizeof buf, "%u", st.wYear);
        out += buf;
        break;
      case 'h':
      case 'H': {
        unsigned h = st.wHour;
        if (c == 'h') {
          h %= 12;
          if (h == 0) h = 12;
        }
        snprintf(buf, sizeof buf, n >= 2 ? "%02u" : "%u", h);
        out += buf;
        break;
      }
      case 'm':
        snprintf(buf, sizeof buf, n >= 2 ? "%02u" : "%u", st.wMinute);
        out += buf;
        break;
      case 's':
        snprintf(buf, sizeof buf, n >= 2 ? "%02u" : "%u", st.wSecond);
        out += buf;
        break;
      case 't':
        out += st.wHour < 12 ? (n >= 2 ? "AM" : "A") : (n >= 2 ? "PM" : "P");
        break;
      default:
        out.append(p, n);
        break;
    }
    p += n;
  }
  return out;
}
static int copy_out(const std::string& s, LPSTR out, int n) {
  if (n <= 0) return (int)s.size() + 1;
  snprintf(out, n, "%s", s.c_str());
  return (int)strlen(out) + 1;
}
int GetDateFormat(DWORD, DWORD flags, const SYSTEMTIME* st, LPCSTR fmt, LPSTR out, int n) {
  SYSTEMTIME now;
  if (!st) {
    GetLocalTime(&now);
    st = &now;
  }
  if (!fmt) fmt = (flags & DATE_LONGDATE) ? "dddd, MMMM dd, yyyy" : "M/d/yyyy";
  return copy_out(picture_format(fmt, *st), out, n);
}
int GetTimeFormat(DWORD, DWORD flags, const SYSTEMTIME* st, LPCSTR fmt, LPSTR out, int n) {
  SYSTEMTIME now;
  if (!st) {
    GetLocalTime(&now);
    st = &now;
  }
  if (!fmt) fmt = (flags & TIME_NOSECONDS) ? "h:mm tt" : "h:mm:ss tt";
  return copy_out(picture_format(fmt, *st), out, n);
}
char* _strtime(char* buf) {
  SYSTEMTIME st;
  GetLocalTime(&st);
  snprintf(buf, 9, "%02u:%02u:%02u", (unsigned)st.wHour % 100, (unsigned)st.wMinute % 100, (unsigned)st.wSecond % 100);
  return buf;
}
char* _strdate(char* buf) {
  SYSTEMTIME st;
  GetLocalTime(&st);
  snprintf(buf, 9, "%02u/%02u/%02u", (unsigned)st.wMonth % 100, (unsigned)st.wDay % 100, (unsigned)st.wYear % 100);
  return buf;
}

// ------------------------------------------------- Microsoft rand()/srand()
// The MSVC CRT's generator (rand.cpp): per-thread state, seed 1 at start.
// The harness may lock the seed: the original seeds it from the wall clock
// (srand(time(NULL)), funeral.cpp:54; srand(GetTickCount()), all.cpp:890),
// so a fixed seed stands for "the clock happened to read this value".
static unsigned int g_ms_rand_state = 1;
static bool g_ms_rand_locked = false;
static unsigned long g_ms_rand_draws = 0;
int fq_ms_rand() {
  g_ms_rand_draws++;
  g_ms_rand_state = g_ms_rand_state * 214013u + 2531011u;
  return (int)((g_ms_rand_state >> 16) & 0x7fff);
}
void fq_ms_srand(unsigned int seed) {
  if (g_ms_rand_locked) return;
  g_ms_rand_state = seed;
}
void fq_ms_rand_seed_and_lock(unsigned int seed, bool lock) {
  g_ms_rand_locked = false;
  fq_ms_srand(seed);
  g_ms_rand_draws = 0;
  g_ms_rand_locked = lock;
}
unsigned long fq_ms_rand_draws() { return g_ms_rand_draws; }

// --------------------------------------------------------------- strings
int stricmp(const char* a, const char* b) { return strcasecmp(a, b); }
int strnicmp(const char* a, const char* b, size_t n) { return strncasecmp(a, b, n); }
char* strupr(char* s) {
  for (char* p = s; *p; p++)
    if (*p >= 'a' && *p <= 'z') *p -= 32;
  return s;
}
char* strlwr(char* s) {
  for (char* p = s; *p; p++)
    if (*p >= 'A' && *p <= 'Z') *p += 32;
  return s;
}
char* strrev(char* s) {
  size_t n = strlen(s);
  for (size_t i = 0; i < n / 2; i++) std::swap(s[i], s[n - 1 - i]);
  return s;
}
char* _strnset(char* s, int c, size_t n) {
  for (size_t i = 0; i < n && s[i]; i++) s[i] = (char)c;
  return s;
}
char* _strset(char* s, int c) {
  for (char* p = s; *p; p++) *p = (char)c;
  return s;
}
static char* to_radix(unsigned long v, bool neg, char* buf, int radix) {
  char tmp[40];
  int i = 0;
  do {
    int d = (int)(v % radix);
    tmp[i++] = (char)(d < 10 ? '0' + d : 'a' + d - 10);
    v /= radix;
  } while (v);
  char* p = buf;
  if (neg) *p++ = '-';
  while (i) *p++ = tmp[--i];
  *p = 0;
  return buf;
}
char* itoa(int v, char* buf, int radix) {
  bool neg = radix == 10 && v < 0;
  return to_radix(neg ? (unsigned long)(-(long)v) : (unsigned long)(unsigned int)v, neg, buf, radix);
}
char* ltoa(long v, char* buf, int radix) {
  bool neg = radix == 10 && v < 0;
  return to_radix(neg ? (unsigned long)(-v) : (unsigned long)v, neg, buf, radix);
}
char* ultoa(unsigned long v, char* buf, int radix) { return to_radix(v, false, buf, radix); }
int lstrlen(LPCSTR s) { return s ? (int)strlen(s) : 0; }
LPSTR lstrcpy(LPSTR d, LPCSTR s) { return strcpy(d, s); }
LPSTR lstrcat(LPSTR d, LPCSTR s) { return strcat(d, s); }
int lstrcmp(LPCSTR a, LPCSTR b) { return strcmp(a, b); }
int lstrcmpi(LPCSTR a, LPCSTR b) { return strcasecmp(a, b); }
int wvsprintf(LPSTR buf, LPCSTR fmt, va_list ap) { return fq_vsprintf(buf, fmt, ap); }
int wsprintf(LPSTR buf, LPCSTR fmt, ...) {
  va_list ap;
  va_start(ap, fmt);
  int n = fq_vsprintf(buf, fmt, ap);
  va_end(ap);
  return n;
}
int MultiByteToWideChar(UINT, DWORD, LPCSTR src, int n, LPWSTR dst, int dn) {
  if (n < 0) n = (int)strlen(src) + 1;
  if (dn == 0) return n;
  int i = 0;
  for (; i < n && i < dn; i++) dst[i] = (wchar_t)(unsigned char)src[i];
  return i;
}
int WideCharToMultiByte(UINT, DWORD, LPCWSTR src, int n, LPSTR dst, int dn, LPCSTR, LPBOOL) {
  if (n < 0) n = (int)fq_wcslen(src) + 1;
  if (dn == 0) return n;
  int i = 0;
  for (; i < n && i < dn; i++) dst[i] = (char)(src[i] & 0xff);
  return i;
}

// -------------------------------------------------------- inert Win32 calls
static DWORD g_last_error = 0;
DWORD GetLastError() { return g_last_error; }
void SetLastError(DWORD e) { g_last_error = e; }
DWORD FormatMessage(DWORD, LPCVOID, DWORD, DWORD, LPSTR buf, DWORD size, va_list*) {
  if (buf && size) buf[0] = 0;
  return 0;
}
void* LocalFree(void*) { return 0; }
void OutputDebugString(LPCSTR) {}
void OutputDebugStringA(LPCSTR) {}
void OutputDebugStringW(LPCWSTR) {}
int MessageBox(HWND, LPCSTR text, LPCSTR, UINT) {
  fprintf(stderr, "[MessageBox] %s\n", text ? text : "");
  return IDOK;
}
int AfxMessageBox(LPCSTR text, UINT, UINT) { return MessageBox(0, text, 0, 0); }
LRESULT SendMessage(HWND, UINT, WPARAM, LPARAM) { return 0; }
BOOL GetVersionEx(OSVERSIONINFO* info) {
  info->dwMajorVersion = 5;
  info->dwMinorVersion = 1;
  info->dwBuildNumber = 2600;
  info->dwPlatformId = VER_PLATFORM_WIN32_NT;
  info->szCSDVersion[0] = 0;
  return TRUE;
}
BOOL PlaySound(LPCSTR, HMODULE, DWORD) { return TRUE; }
HINSTANCE ShellExecute(HWND, LPCSTR, LPCSTR, LPCSTR, LPCSTR, int) { return 0; }
DWORD GetModuleFileName(HMODULE, LPSTR buf, DWORD n) {
  snprintf(buf, n, "C:\\fq\\fq.exe");
  return (DWORD)strlen(buf);
}
DWORD GetCurrentDirectory(DWORD n, LPSTR buf) {
  snprintf(buf, n, "C:\\fq");
  return (DWORD)strlen(buf);
}
BOOL SetCurrentDirectory(LPCSTR) { return TRUE; }
BOOL CreateDirectory(LPCSTR p, SECURITY_ATTRIBUTES*) { return fq_mkdir(p) == 0; }
BOOL DeleteFile(LPCSTR p) { return fq_unlink(p) == 0; }
BOOL CopyFile(LPCSTR, LPCSTR, BOOL) { return FALSE; }
BOOL MoveFile(LPCSTR a, LPCSTR b) { return fq_rename(a, b) == 0; }
DWORD GetFileAttributes(LPCSTR p) { return fq_access(p, 0) == 0 ? 0 : INVALID_FILE_ATTRIBUTES; }
BOOL GetCursorPos(POINT* p) {
  p->x = p->y = 0;
  return TRUE;
}
BOOL SetForegroundWindow(HWND) { return TRUE; }
BOOL ShowWindow(HWND, int) { return TRUE; }
BOOL CloseHandle(HANDLE) { return TRUE; }
BOOL DeleteObject(HGDIOBJ) { return TRUE; }
HANDLE CreateMutex(SECURITY_ATTRIBUTES*, BOOL, LPCSTR) { return 0; }
DWORD WaitForSingleObject(HANDLE, DWORD) { return 0; }
BOOL ReleaseMutex(HANDLE) { return TRUE; }
long RegOpenKeyEx(HKEY, LPCSTR, DWORD, DWORD, HKEY*) { return 1; }
long RegQueryValueEx(HKEY, LPCSTR, DWORD*, DWORD*, BYTE*, DWORD*) { return 1; }
long RegSetValueEx(HKEY, LPCSTR, DWORD, DWORD, const BYTE*, DWORD) { return 1; }
long RegCreateKeyEx(HKEY, LPCSTR, DWORD, LPSTR, DWORD, DWORD, SECURITY_ATTRIBUTES*, HKEY*, DWORD*) { return 1; }
long RegCloseKey(HKEY) { return 0; }
HGLOBAL GlobalAlloc(UINT, size_t n) { return (HGLOBAL)calloc(1, n); }
HGLOBAL GlobalFree(void* p) {
  free(p);
  return 0;
}
BOOL CreateProcess(LPCSTR, LPSTR, SECURITY_ATTRIBUTES*, SECURITY_ATTRIBUTES*, BOOL, DWORD, LPVOID, LPCSTR,
                   STARTUPINFO*, PROCESS_INFORMATION*) {
  return FALSE;
}
long _findfirst(const char*, _finddata_t*) { return -1; }
int _findnext(long, _finddata_t*) { return -1; }
int _findclose(long) { return 0; }
long _filelength(int fd) {
  struct ::stat st;
  if (fstat(fd, &st) != 0) return -1;
  return (long)st.st_size;
}
uintptr_t _beginthread(void (*fn)(void*), unsigned, void* arg) {
  fn(arg);
  return 1;
}
static CWinApp g_fq_app;
CWinApp* AfxGetApp() { return &g_fq_app; }
HINSTANCE AfxGetInstanceHandle() { return 0; }
// Threads run to completion at once: the original starts one worker,
// get_server_dat (server_connect.cpp:97), which only sets licence limits.
CWinThread* AfxBeginThread(AFX_THREADPROC fn, LPVOID param, int, UINT, DWORD, SECURITY_ATTRIBUTES*) {
  fn(param);
  static CWinThread thread;
  return &thread;
}

// ----------------------------------------------------------------- winsock
char* inet_ntoa(struct in_addr in) {
  static char buf[20];
  snprintf(buf, sizeof buf, "%u.%u.%u.%u", in.S_un.S_un_b.s_b1, in.S_un.S_un_b.s_b2, in.S_un.S_un_b.s_b3,
           in.S_un.S_un_b.s_b4);
  return buf;
}
unsigned long inet_addr(const char* cp) {
  unsigned a = 0, b = 0, c = 0, d = 0;
  if (sscanf(cp, "%u.%u.%u.%u", &a, &b, &c, &d) != 4) return 0xffffffffUL;
  return (unsigned long)(a | (b << 8) | (c << 16) | (d << 24));
}
unsigned short htons(unsigned short v) { return (unsigned short)((v >> 8) | (v << 8)); }
unsigned short ntohs(unsigned short v) { return htons(v); }
unsigned long htonl(unsigned long v) {
  return ((v & 0xff) << 24) | ((v & 0xff00) << 8) | ((v >> 8) & 0xff00) | ((v >> 24) & 0xff);
}
unsigned long ntohl(unsigned long v) { return htonl(v); }
int closesocket(SOCKET) { return 0; }
int send(SOCKET, const char*, int len, int) { return len; }
int recv(SOCKET, char*, int, int) { return 0; }
int WSAGetLastError() { return 0; }
int WSAAsyncSelect(SOCKET, HWND, UINT, long) { return 0; }

// ------------------------------------------------------------------- CTime
CTime CTime::GetCurrentTime() { return CTime(g_fq_clock); }
static struct tm tm_of(time_t t) {
  struct tm v;
  localtime_r(&t, &v);
  return v;
}
int CTime::GetYear() const { return tm_of(t).tm_year + 1900; }
int CTime::GetMonth() const { return tm_of(t).tm_mon + 1; }
int CTime::GetDay() const { return tm_of(t).tm_mday; }
int CTime::GetHour() const { return tm_of(t).tm_hour; }
int CTime::GetMinute() const { return tm_of(t).tm_min; }
int CTime::GetSecond() const { return tm_of(t).tm_sec; }
int CTime::GetDayOfWeek() const { return tm_of(t).tm_wday + 1; }
CString CTime::Format(LPCSTR fmt) const {
  struct tm v = tm_of(t);
  char buf[256];
  strftime(buf, sizeof buf, fmt, &v);
  return CString(buf);
}
