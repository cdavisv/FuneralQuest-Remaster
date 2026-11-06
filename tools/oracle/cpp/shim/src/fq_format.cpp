// printf-family formatting with the MSVC semantics the original relies on.
//
// The original passes CString objects straight to "%s" (CString::Format,
// sprintf, LogMsg, broadcast...). MSVC copies the object bitwise, so the
// callee sees the character pointer. g++ instead passes the address of a
// temporary copy. Every live CString registers its address
// (fq_cstring.cpp), so here an argument for "%s" that is the address of a live
// CString is replaced by that CString's text, which is exactly what MSVC's
// bitwise copy delivered. All other conversions go to the C library one
// conversion at a time. Narrow "%S" / "%ls" / "%ws" take a 16-bit wide string
// (the build uses -fshort-wchar so wchar_t matches Windows).
#include <cstdarg>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

#include "fq_cstring.h"

typedef wchar_t fq_wchar16;  // 16-bit: built with -fshort-wchar

static std::string narrow_of_wide(const fq_wchar16* w) {
  std::string s;
  if (!w) return "(null)";
  while (*w) {
    s.push_back((char)(*w & 0xff));
    w++;
  }
  return s;
}

// wide_args: in a wide printf (swprintf), "%s" means a wide string and "%S" a
// narrow one (the MSVC legacy rule).
static std::string vformat(const char* fmt, va_list ap, bool wide_args) {
  std::string out;
  const char* p = fmt;
  while (*p) {
    if (*p != '%') {
      out.push_back(*p++);
      continue;
    }
    const char* start = p++;
    if (*p == '%') {
      out.push_back('%');
      p++;
      continue;
    }
    std::string spec = "%";
    // flags
    while (*p && strchr("-+ #0", *p)) spec.push_back(*p++);
    // width
    if (*p == '*') {
      int w = va_arg(ap, int);
      spec += std::to_string(w);
      p++;
    } else {
      while (*p >= '0' && *p <= '9') spec.push_back(*p++);
    }
    // precision
    if (*p == '.') {
      spec.push_back(*p++);
      if (*p == '*') {
        int pr = va_arg(ap, int);
        spec += std::to_string(pr);
        p++;
      } else {
        while (*p >= '0' && *p <= '9') spec.push_back(*p++);
      }
    }
    // length
    int size = 0;  // 0 default, 1 h, 2 l, 3 ll/I64, 4 L
    bool wideStr = false;
    for (;;) {
      if (*p == 'h') {
        size = 1;
        p++;
        if (*p == 'h') p++;
      } else if (*p == 'l') {
        size = (size == 2) ? 3 : 2;
        p++;
      } else if (*p == 'w') {
        wideStr = true;
        p++;
      } else if (*p == 'L') {
        size = 4;
        p++;
      } else if (*p == 'I' && p[1] == '6' && p[2] == '4') {
        size = 3;
        p += 3;
      } else if (*p == 'I' && p[1] == '3' && p[2] == '2') {
        size = 0;
        p += 3;
      } else if (*p == 'I') {
        size = 0;
        p++;
      } else if (*p == 'z' || *p == 'j' || *p == 't') {
        p++;
      } else {
        break;
      }
    }
    char conv = *p;
    if (!conv) {
      out.append(start);
      break;
    }
    p++;
    char buf[512];
    switch (conv) {
      case 'd':
      case 'i':
      case 'u':
      case 'o':
      case 'x':
      case 'X': {
        if (size == 3) {
          long long v = va_arg(ap, long long);
          std::string s2 = spec + "ll" + conv;
          snprintf(buf, sizeof buf, s2.c_str(), v);
        } else {
          int v = va_arg(ap, int);
          if (size == 1) v = (conv == 'd' || conv == 'i') ? (int)(short)v : (int)(unsigned short)v;
          std::string s2 = spec + conv;
          snprintf(buf, sizeof buf, s2.c_str(), v);
        }
        out += buf;
        break;
      }
      case 'e':
      case 'E':
      case 'f':
      case 'F':
      case 'g':
      case 'G':
      case 'a':
      case 'A': {
        double v = (size == 4) ? (double)va_arg(ap, long double) : va_arg(ap, double);
        std::string s2 = spec + conv;
        snprintf(buf, sizeof buf, s2.c_str(), v);
        out += buf;
        break;
      }
      case 'c':
      case 'C': {
        int v = va_arg(ap, int);
        std::string s2 = spec + 'c';
        snprintf(buf, sizeof buf, s2.c_str(), (char)(v & 0xff));
        out += buf;
        break;
      }
      case 'p': {
        void* v = va_arg(ap, void*);
        snprintf(buf, sizeof buf, "%08X", (unsigned)(size_t)v);
        out += buf;
        break;
      }
      case 'n': {
        int* v = va_arg(ap, int*);
        if (v) *v = (int)out.size();
        break;
      }
      case 's':
      case 'S': {
        void* v = va_arg(ap, void*);
        bool isWide = wideStr || size == 2 || (conv == 'S') != wide_args;
        if (size == 1) isWide = false;
        std::string text;
        if (v && fq_cstring_is_live(v)) {
          // A CString passed by value: MSVC hands over its character pointer.
          text = static_cast<const CString*>(v)->m_pszData;
        } else if (isWide) {
          text = narrow_of_wide((const fq_wchar16*)v);
        } else {
          text = v ? (const char*)v : "(null)";
        }
        std::string s2 = spec + 's';
        size_t need = text.size() + 64;
        char* big = (char*)malloc(need + 1024);
        snprintf(big, need + 1024, s2.c_str(), text.c_str());
        out += big;
        free(big);
        break;
      }
      default:
        out.append(start, p - start);
        break;
    }
  }
  return out;
}

int fq_vformat_alloc(char** result, const char* fmt, va_list ap) {
  std::string s = vformat(fmt ? fmt : "", ap, false);
  *result = (char*)malloc(s.size() + 1);
  memcpy(*result, s.c_str(), s.size() + 1);
  return (int)s.size();
}

extern "C++" {
int fq_vsprintf(char* buf, const char* fmt, va_list ap) {
  std::string s = vformat(fmt, ap, false);
  memcpy(buf, s.c_str(), s.size() + 1);
  return (int)s.size();
}
int fq_sprintf(char* buf, const char* fmt, ...) {
  va_list ap;
  va_start(ap, fmt);
  int n = fq_vsprintf(buf, fmt, ap);
  va_end(ap);
  return n;
}
// _vsnprintf: writes at most count chars, no terminator when truncated, -1.
int fq_vsnprintf_ms(char* buf, size_t count, const char* fmt, va_list ap) {
  std::string s = vformat(fmt, ap, false);
  if (s.size() > count) {
    memcpy(buf, s.c_str(), count);
    return -1;
  }
  memcpy(buf, s.c_str(), s.size());
  if (s.size() < count) buf[s.size()] = 0;
  return (int)s.size();
}
int fq_snprintf_ms(char* buf, size_t count, const char* fmt, ...) {
  va_list ap;
  va_start(ap, fmt);
  int n = fq_vsnprintf_ms(buf, count, fmt, ap);
  va_end(ap);
  return n;
}
int fq_vprintf(const char* fmt, va_list ap) {
  std::string s = vformat(fmt, ap, false);
  fputs(s.c_str(), stderr);
  return (int)s.size();
}
int fq_printf(const char* fmt, ...) {
  va_list ap;
  va_start(ap, fmt);
  int n = fq_vprintf(fmt, ap);
  va_end(ap);
  return n;
}
int fq_vfprintf(FILE* f, const char* fmt, va_list ap) {
  std::string s = vformat(fmt, ap, false);
  fputs(s.c_str(), f);
  return (int)s.size();
}
int fq_fprintf(FILE* f, const char* fmt, ...) {
  va_list ap;
  va_start(ap, fmt);
  int n = fq_vfprintf(f, fmt, ap);
  va_end(ap);
  return n;
}

// Wide (16-bit) printf: the format is wide; "%s" is a wide string.
int fq_vswprintf16(fq_wchar16* buf, const fq_wchar16* wfmt, va_list ap) {
  std::string fmt = narrow_of_wide(wfmt);
  std::string s = vformat(fmt.c_str(), ap, true);
  for (size_t i = 0; i < s.size(); i++) buf[i] = (unsigned char)s[i];
  buf[s.size()] = 0;
  return (int)s.size();
}
int fq_swprintf16(fq_wchar16* buf, const fq_wchar16* wfmt, ...) {
  va_list ap;
  va_start(ap, wfmt);
  int n = fq_vswprintf16(buf, wfmt, ap);
  va_end(ap);
  return n;
}
}
