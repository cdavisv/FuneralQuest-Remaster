// 16-bit wide-string functions (the build uses -fshort-wchar, glibc's wcs*
// functions assume 32-bit wchar_t). Semantics are the Microsoft CRT's in the
// "C" locale: case folding is ASCII only.
#include "fq_win32.h"

namespace {
wchar_t lower(wchar_t c) { return (c >= L'A' && c <= L'Z') ? (wchar_t)(c + 32) : c; }
wchar_t upper(wchar_t c) { return (c >= L'a' && c <= L'z') ? (wchar_t)(c - 32) : c; }
std::string narrow(const wchar_t* s) {
  std::string out;
  while (s && *s) out.push_back((char)(*s++ & 0xff));
  return out;
}
}  // namespace

size_t fq_wcslen(const wchar_t* s) {
  size_t n = 0;
  while (s[n]) n++;
  return n;
}
wchar_t* fq_wcscpy(wchar_t* d, const wchar_t* s) {
  wchar_t* r = d;
  while ((*d++ = *s++)) {
  }
  return r;
}
wchar_t* fq_wcsncpy(wchar_t* d, const wchar_t* s, size_t n) {
  size_t i = 0;
  for (; i < n && s[i]; i++) d[i] = s[i];
  for (; i < n; i++) d[i] = 0;
  return d;
}
wchar_t* fq_wcscat(wchar_t* d, const wchar_t* s) {
  fq_wcscpy(d + fq_wcslen(d), s);
  return d;
}
int fq_wcscmp(const wchar_t* a, const wchar_t* b) {
  while (*a && *a == *b) {
    a++;
    b++;
  }
  return (int)(unsigned short)*a - (int)(unsigned short)*b;
}
int fq_wcsncmp(const wchar_t* a, const wchar_t* b, size_t n) {
  for (size_t i = 0; i < n; i++) {
    if (a[i] != b[i] || !a[i]) return (int)(unsigned short)a[i] - (int)(unsigned short)b[i];
  }
  return 0;
}
int fq_wcsicmp(const wchar_t* a, const wchar_t* b) {
  for (;; a++, b++) {
    wchar_t ca = lower(*a), cb = lower(*b);
    if (ca != cb || !ca) return (int)(unsigned short)ca - (int)(unsigned short)cb;
  }
}
int fq_wcsnicmp(const wchar_t* a, const wchar_t* b, size_t n) {
  for (size_t i = 0; i < n; i++) {
    wchar_t ca = lower(a[i]), cb = lower(b[i]);
    if (ca != cb || !ca) return (int)(unsigned short)ca - (int)(unsigned short)cb;
  }
  return 0;
}
wchar_t* fq_wcschr(const wchar_t* s, wchar_t c) {
  for (;; s++) {
    if (*s == c) return (wchar_t*)s;
    if (!*s) return 0;
  }
}
wchar_t* fq_wcsrchr(const wchar_t* s, wchar_t c) {
  const wchar_t* hit = 0;
  for (;; s++) {
    if (*s == c) hit = s;
    if (!*s) return (wchar_t*)hit;
  }
}
wchar_t* fq_wcsstr(const wchar_t* s, const wchar_t* sub) {
  size_t n = fq_wcslen(sub);
  if (!n) return (wchar_t*)s;
  for (; *s; s++) {
    if (fq_wcsncmp(s, sub, n) == 0) return (wchar_t*)s;
  }
  return 0;
}
wchar_t* fq_wcspbrk(const wchar_t* s, const wchar_t* set) {
  for (; *s; s++) {
    for (const wchar_t* p = set; *p; p++)
      if (*p == *s) return (wchar_t*)s;
  }
  return 0;
}
wchar_t* fq_wcsupr(wchar_t* s) {
  for (wchar_t* p = s; *p; p++) *p = upper(*p);
  return s;
}
wchar_t* fq_wcslwr(wchar_t* s) {
  for (wchar_t* p = s; *p; p++) *p = lower(*p);
  return s;
}
int fq_wtoi(const wchar_t* s) { return atoi(narrow(s).c_str()); }
long fq_wtol(const wchar_t* s) { return atol(narrow(s).c_str()); }
double fq_wtof(const wchar_t* s) { return atof(narrow(s).c_str()); }
double fq_wcstod(const wchar_t* s, wchar_t** end) {
  std::string n = narrow(s);
  char* e = 0;
  double v = strtod(n.c_str(), &e);
  if (end) *end = (wchar_t*)(s + (e - n.c_str()));
  return v;
}
long fq_wcstol(const wchar_t* s, wchar_t** end, int base) {
  std::string n = narrow(s);
  char* e = 0;
  long v = strtol(n.c_str(), &e, base);
  if (end) *end = (wchar_t*)(s + (e - n.c_str()));
  return v;
}
int fq_iswspace(wchar_t c) { return c == L' ' || (c >= 9 && c <= 13); }
int fq_iswdigit(wchar_t c) { return c >= L'0' && c <= L'9'; }
wchar_t fq_towlower(wchar_t c) { return lower(c); }
wchar_t fq_towupper(wchar_t c) { return upper(c); }

FILE* fq_wfopen(const wchar_t* name, const wchar_t* mode) {
  return fq_fopen(narrow(name).c_str(), narrow(mode).c_str());
}
