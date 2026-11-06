// CString implementation for the oracle shim. Each method follows the
// corresponding ATL CStringT / CSimpleStringT code in VS2019 atlsimpstr.h and
// cstringt.h (single-byte char traits, "C" locale).
#include "fq_cstring.h"

#include <cctype>
#include <cstdio>
#include <cstdlib>
#include <unordered_set>

namespace {
std::unordered_set<const void*>& registry() {
  static std::unordered_set<const void*>* r = new std::unordered_set<const void*>();
  return *r;
}
// ChTraitsCRT<char>::IsSpace is _isspace_l in the C locale: space, \t \n \v \f \r.
bool is_space(char ch) {
  unsigned char c = (unsigned char)ch;
  return c == ' ' || (c >= 9 && c <= 13);
}
char lower(char ch) { return (ch >= 'A' && ch <= 'Z') ? (char)(ch + 32) : ch; }
char upper(char ch) { return (ch >= 'a' && ch <= 'z') ? (char)(ch - 32) : ch; }
}  // namespace

void fq_cstring_register(const void* p) { registry().insert(p); }
void fq_cstring_unregister(const void* p) { registry().erase(p); }
bool fq_cstring_is_live(const void* p) { return registry().count(p) != 0; }

void CString::init(const char* s, int n) {
  int cap = n < 15 ? 15 : n;
  Header* h = (Header*)malloc(sizeof(Header) + cap + 1);
  h->len = n;
  h->cap = cap;
  m_pszData = (char*)(h + 1);
  memcpy(m_pszData, s, n);
  m_pszData[n] = 0;
  fq_cstring_register(this);
}

CString::CString(char ch, int repeat) {
  if (repeat < 0) repeat = 0;
  init("", 0);
  reserve(repeat);
  memset(m_pszData, ch, repeat);
  hdr()->len = repeat;
  m_pszData[repeat] = 0;
}

CString::CString(const wchar_t* ws) {
  init("", 0);
  *this = ws;
}

CString::~CString() {
  fq_cstring_unregister(this);
  free(hdr());
  m_pszData = nullptr;
}

void CString::reserve(int n) {
  if (n <= hdr()->cap) return;
  int cap = hdr()->cap * 2;
  if (cap < n) cap = n;
  Header* h = (Header*)realloc(hdr(), sizeof(Header) + cap + 1);
  h->cap = cap;
  m_pszData = (char*)(h + 1);
}

void CString::set(const char* s, int n) {
  if (s >= m_pszData && s <= m_pszData + GetLength()) {
    // Source overlaps our own buffer (ATL handles this with a copy).
    char* tmp = (char*)malloc(n + 1);
    memcpy(tmp, s, n);
    reserve(n);
    memcpy(m_pszData, tmp, n);
    free(tmp);
  } else {
    reserve(n);
    memcpy(m_pszData, s, n);
  }
  hdr()->len = n;
  m_pszData[n] = 0;
}

void CString::append(const char* s, int n) {
  if (n <= 0) return;
  int old = GetLength();
  if (s >= m_pszData && s <= m_pszData + old) {
    char* tmp = (char*)malloc(n);
    memcpy(tmp, s, n);
    reserve(old + n);
    memcpy(m_pszData + old, tmp, n);
    free(tmp);
  } else {
    reserve(old + n);
    memcpy(m_pszData + old, s, n);
  }
  hdr()->len = old + n;
  m_pszData[old + n] = 0;
}

CString& CString::operator=(const CString& o) {
  if (this != &o) set(o.m_pszData, o.GetLength());
  return *this;
}
CString& CString::operator=(const char* s) {
  if (!s) s = "";
  set(s, (int)strlen(s));
  return *this;
}
CString& CString::operator=(char ch) {
  set(&ch, 1);
  return *this;
}
CString& CString::operator=(const wchar_t* ws) {
  // ATL converts with the ANSI code page; the content here is ASCII.
  Empty();
  if (!ws) return *this;
  while (*ws) {
    char c = (char)(*ws & 0xff);
    append(&c, 1);
    ws++;
  }
  return *this;
}

void CString::Empty() {
  hdr()->len = 0;
  m_pszData[0] = 0;
}

void CString::SetAt(int i, char ch) { m_pszData[i] = ch; }

char* CString::GetBuffer() { return m_pszData; }
char* CString::GetBuffer(int nMinBufLength) {
  if (nMinBufLength < GetLength()) nMinBufLength = GetLength();
  reserve(nMinBufLength);
  return m_pszData;
}
char* CString::GetBufferSetLength(int nLength) {
  reserve(nLength);
  hdr()->len = nLength;
  m_pszData[nLength] = 0;
  return m_pszData;
}
void CString::ReleaseBuffer(int nNewLength) {
  if (nNewLength == -1) {
    // strnlen over the buffer, as ATL does.
    int cap = hdr()->cap;
    nNewLength = (int)strnlen(m_pszData, cap + 1);
  }
  hdr()->len = nNewLength;
  m_pszData[nNewLength] = 0;
}

int CString::CompareNoCase(const char* s) const {
  // _stricmp: compares tolower() of each byte.
  const unsigned char* a = (const unsigned char*)m_pszData;
  const unsigned char* b = (const unsigned char*)s;
  while (true) {
    int ca = lower((char)*a), cb = lower((char)*b);
    ca = (unsigned char)ca;
    cb = (unsigned char)cb;
    if (ca != cb) return ca - cb;
    if (!ca) return 0;
    a++;
    b++;
  }
}

// CStringT::Mid (cstringt.h): negative first or count clamp to 0; the count
// is cut at the end of the string; a first past the end gives "".
CString CString::Mid(int iFirst, int nCount) const {
  if (iFirst < 0) iFirst = 0;
  if (nCount < 0) nCount = 0;
  int len = GetLength();
  if (iFirst + nCount > len) nCount = len - iFirst;
  if (iFirst > len) nCount = 0;
  if (iFirst == 0 && iFirst + nCount == len) return *this;
  return CString(m_pszData + iFirst, nCount);
}
CString CString::Left(int nCount) const {
  if (nCount < 0) nCount = 0;
  int len = GetLength();
  if (nCount >= len) return *this;
  return CString(m_pszData, nCount);
}
CString CString::Right(int nCount) const {
  if (nCount < 0) nCount = 0;
  int len = GetLength();
  if (nCount >= len) return *this;
  return CString(m_pszData + len - nCount, nCount);
}
CString CString::SpanIncluding(const char* set) const {
  return Left((int)strspn(m_pszData, set));
}
CString CString::SpanExcluding(const char* set) const {
  return Left((int)strcspn(m_pszData, set));
}
CString CString::Tokenize(const char* tokens, int& iStart) const {
  if (tokens == nullptr || *tokens == 0) {
    if (iStart < GetLength()) return CString(m_pszData + iStart);
  } else {
    const char* place = m_pszData + iStart;
    const char* end = m_pszData + GetLength();
    if (place < end) {
      int including = (int)strspn(place, tokens);
      if (place + including < end) {
        place += including;
        int excluding = (int)strcspn(place, tokens);
        int from = iStart + including;
        iStart = from + excluding + 1;
        return Mid(from, excluding);
      }
    }
  }
  iStart = -1;
  return CString();
}

CString& CString::MakeUpper() {
  for (int i = 0; i < GetLength(); i++) m_pszData[i] = upper(m_pszData[i]);
  return *this;
}
CString& CString::MakeLower() {
  for (int i = 0; i < GetLength(); i++) m_pszData[i] = lower(m_pszData[i]);
  return *this;
}
CString& CString::MakeReverse() {
  int n = GetLength();
  for (int i = 0; i < n / 2; i++) {
    char t = m_pszData[i];
    m_pszData[i] = m_pszData[n - 1 - i];
    m_pszData[n - 1 - i] = t;
  }
  return *this;
}

int CString::Replace(char chOld, char chNew) {
  int count = 0;
  if (chOld == chNew) return 0;
  for (int i = 0; i < GetLength(); i++) {
    if (m_pszData[i] == chOld) {
      m_pszData[i] = chNew;
      count++;
    }
  }
  return count;
}

// CStringT::Replace(PCXSTR, PCXSTR): an empty or NULL old string replaces
// nothing; matches are found left to right without overlap.
int CString::Replace(const char* pszOld, const char* pszNew) {
  int oldLen = pszOld ? (int)strlen(pszOld) : 0;
  if (oldLen == 0) return 0;
  int newLen = pszNew ? (int)strlen(pszNew) : 0;
  int count = 0;
  CString out;
  const char* p = m_pszData;
  const char* end = m_pszData + GetLength();
  while (p < end) {
    const char* hit = strstr(p, pszOld);
    if (!hit) break;
    out.append(p, (int)(hit - p));
    out.append(pszNew ? pszNew : "", newLen);
    p = hit + oldLen;
    count++;
  }
  if (count == 0) return 0;
  out.append(p, (int)(end - p));
  set(out.m_pszData, out.GetLength());
  return count;
}

int CString::Remove(char ch) {
  int n = GetLength(), w = 0, count = 0;
  for (int i = 0; i < n; i++) {
    if (m_pszData[i] == ch) {
      count++;
      continue;
    }
    m_pszData[w++] = m_pszData[i];
  }
  hdr()->len = w;
  m_pszData[w] = 0;
  return count;
}

int CString::Insert(int iIndex, char ch) {
  char s[2] = {ch, 0};
  return Insert(iIndex, s);
}
int CString::Insert(int iIndex, const char* psz) {
  if (iIndex < 0) iIndex = 0;
  int len = GetLength();
  if (iIndex > len) iIndex = len;
  int n = psz ? (int)strlen(psz) : 0;
  if (n > 0) {
    CString tail(m_pszData + iIndex, len - iIndex);
    CString ins(psz, n);
    hdr()->len = iIndex;
    m_pszData[iIndex] = 0;
    append(ins.m_pszData, n);
    append(tail.m_pszData, tail.GetLength());
  }
  return GetLength();
}
int CString::Delete(int iIndex, int nCount) {
  if (iIndex < 0) iIndex = 0;
  if (nCount < 0) nCount = 0;
  int len = GetLength();
  if (nCount + iIndex > len) nCount = len - iIndex;
  if (nCount > 0) {
    int newLen = len - nCount;
    memmove(m_pszData + iIndex, m_pszData + iIndex + nCount, len - iIndex - nCount + 1);
    hdr()->len = newLen;
  }
  return GetLength();
}

CString& CString::TrimLeft() {
  int i = 0, n = GetLength();
  while (i < n && is_space(m_pszData[i])) i++;
  if (i) Delete(0, i);
  return *this;
}
CString& CString::TrimLeft(char ch) {
  int i = 0, n = GetLength();
  while (i < n && m_pszData[i] == ch) i++;
  if (i) Delete(0, i);
  return *this;
}
CString& CString::TrimLeft(const char* set) {
  if (!set || !*set) return *this;
  int i = 0, n = GetLength();
  while (i < n && strchr(set, m_pszData[i])) i++;
  if (i) Delete(0, i);
  return *this;
}
// ATL TrimRight walks forward remembering the start of the last run of
// trailing characters; the result is the same as trimming from the end.
CString& CString::TrimRight() {
  int n = GetLength();
  while (n > 0 && is_space(m_pszData[n - 1])) n--;
  hdr()->len = n;
  m_pszData[n] = 0;
  return *this;
}
CString& CString::TrimRight(char ch) {
  int n = GetLength();
  while (n > 0 && m_pszData[n - 1] == ch) n--;
  hdr()->len = n;
  m_pszData[n] = 0;
  return *this;
}
CString& CString::TrimRight(const char* set) {
  if (!set || !*set) return *this;
  int n = GetLength();
  while (n > 0 && strchr(set, m_pszData[n - 1])) n--;
  hdr()->len = n;
  m_pszData[n] = 0;
  return *this;
}

int CString::Find(char ch, int iStart) const {
  int len = GetLength();
  if (iStart < 0 || iStart >= len) return -1;
  const char* p = strchr(m_pszData + iStart, ch);
  return p ? (int)(p - m_pszData) : -1;
}
int CString::Find(const char* psz, int iStart) const {
  int len = GetLength();
  if (psz == nullptr) return -1;
  if (iStart < 0 || iStart > len) return -1;
  const char* p = strstr(m_pszData + iStart, psz);
  return p ? (int)(p - m_pszData) : -1;
}
int CString::ReverseFind(char ch) const {
  const char* p = strrchr(m_pszData, ch);
  return p ? (int)(p - m_pszData) : -1;
}
int CString::FindOneOf(const char* set) const {
  const char* p = strpbrk(m_pszData, set);
  return p ? (int)(p - m_pszData) : -1;
}

void CString::FormatV(const char* fmt, va_list ap) {
  char* out = nullptr;
  int n = fq_vformat_alloc(&out, fmt, ap);
  set(out, n);
  free(out);
}
void CString::Format(const char* fmt, ...) {
  va_list ap;
  va_start(ap, fmt);
  FormatV(fmt, ap);
  va_end(ap);
}
void CString::AppendFormat(const char* fmt, ...) {
  va_list ap;
  va_start(ap, fmt);
  char* out = nullptr;
  int n = fq_vformat_alloc(&out, fmt, ap);
  va_end(ap);
  append(out, n);
  free(out);
}

CString operator+(const CString& a, const CString& b) {
  CString r(a);
  r += b;
  return r;
}
CString operator+(const CString& a, const char* b) {
  CString r(a);
  r += b;
  return r;
}
CString operator+(const char* a, const CString& b) {
  CString r(a);
  r += b;
  return r;
}
CString operator+(const CString& a, char b) {
  CString r(a);
  r += b;
  return r;
}
CString operator+(char a, const CString& b) {
  CString r(a, 1);
  r += b;
  return r;
}
