// CString stand-in for the oracle build (tools/oracle).
//
// Reproduces the ATL/MFC CStringT<char> behaviour the original server relies
// on (VS2019 atlstr.h, CharacterSet NotSet = single-byte char). Every method
// follows the ATL source semantics noted beside it; nothing here is tuned to
// make numbers agree.
//
// The object is a single pointer, as in MFC (sizeof(CString) == 4 on x86).
// MFC passes a CString through "..." bitwise, so printf("%s", cst) works on
// MSVC. g++ passes non-trivially-copyable objects through "..." by invisible
// reference instead, so every live CString registers its own address and
// fq_vformat() (fq_format.cpp) resolves a %s argument that is the address of
// a live CString to its text. See fq_format.cpp.
#pragma once

#include <cstdarg>
#include <cstddef>
#include <cstring>

typedef const char* LPCSTR_;

void fq_cstring_register(const void* p);
void fq_cstring_unregister(const void* p);
bool fq_cstring_is_live(const void* p);
// printf-style formatting with MSVC semantics for CString %s (fq_format.cpp).
int fq_vformat_alloc(char** out, const char* fmt, va_list ap);

class CString {
 public:
  // ---- construction ----
  CString() { init("", 0); }
  CString(const char* s) { init(s ? s : "", s ? (int)strlen(s) : 0); }
  CString(const unsigned char* s) { const char* c = (const char*)s; init(c ? c : "", c ? (int)strlen(c) : 0); }
  CString(const char* s, int n) { init(s ? s : "", s ? n : 0); }
  CString(char ch, int repeat = 1);
  CString(const wchar_t* ws);  // ANSI conversion of a wide string (ATL does this)
  CString(const CString& o) { init(o.m_pszData, o.GetLength()); }
  ~CString();

  CString& operator=(const CString& o);
  CString& operator=(const char* s);
  CString& operator=(const unsigned char* s) { return *this = (const char*)s; }
  CString& operator=(char ch);
  CString& operator=(const wchar_t* ws);

  // ---- access ----
  int GetLength() const { return hdr()->len; }
  bool IsEmpty() const { return GetLength() == 0; }
  void Empty();
  char GetAt(int i) const { return m_pszData[i]; }
  void SetAt(int i, char ch);
  char operator[](int i) const { return m_pszData[i]; }
  operator const char*() const { return m_pszData; }
  const char* GetString() const { return m_pszData; }

  // ---- buffer ----
  char* GetBuffer();
  char* GetBuffer(int nMinBufLength);
  char* GetBufferSetLength(int nLength);
  void ReleaseBuffer(int nNewLength = -1);
  void FreeExtra() {}
  void Preallocate(int n) { reserve(n); }

  // ---- concatenation ----
  CString& operator+=(const CString& s) { append(s.m_pszData, s.GetLength()); return *this; }
  CString& operator+=(const char* s) { if (s) append(s, (int)strlen(s)); return *this; }
  CString& operator+=(char ch) { append(&ch, 1); return *this; }
  CString& operator+=(const wchar_t* ws) { return *this += CString(ws); }
  void Append(const char* s) { *this += s; }
  void Append(const CString& s) { *this += s; }
  void AppendChar(char ch) { *this += ch; }

  // ---- comparison ----
  int Compare(const char* s) const { return strcmp(m_pszData, s); }
  int CompareNoCase(const char* s) const;
  int Collate(const char* s) const { return strcmp(m_pszData, s); }
  int CollateNoCase(const char* s) const { return CompareNoCase(s); }

  // ---- extraction ----
  CString Mid(int iFirst) const { return Mid(iFirst, GetLength() - iFirst); }
  CString Mid(int iFirst, int nCount) const;
  CString Left(int nCount) const;
  CString Right(int nCount) const;
  CString SpanIncluding(const char* set) const;
  CString SpanExcluding(const char* set) const;
  CString Tokenize(const char* tokens, int& iStart) const;

  // ---- modification ----
  CString& MakeUpper();
  CString& MakeLower();
  CString& MakeReverse();
  int Replace(char chOld, char chNew);
  int Replace(const char* pszOld, const char* pszNew);
  int Remove(char ch);
  int Insert(int iIndex, char ch);
  int Insert(int iIndex, const char* psz);
  int Delete(int iIndex, int nCount = 1);
  CString& TrimLeft();
  CString& TrimLeft(char ch);
  CString& TrimLeft(const char* set);
  CString& TrimRight();
  CString& TrimRight(char ch);
  CString& TrimRight(const char* set);
  CString& Trim() { TrimRight(); return TrimLeft(); }
  CString& Trim(char ch) { TrimRight(ch); return TrimLeft(ch); }
  CString& Trim(const char* set) { TrimRight(set); return TrimLeft(set); }

  // ---- search ----
  int Find(char ch, int iStart = 0) const;
  int Find(const char* psz, int iStart = 0) const;
  int ReverseFind(char ch) const;
  int FindOneOf(const char* set) const;

  // ---- formatting ----
  void Format(const char* fmt, ...);
  void FormatV(const char* fmt, va_list ap);
  void AppendFormat(const char* fmt, ...);
  bool LoadString(unsigned int) { Empty(); return false; }

  // Bytes of the object are the data pointer only, as in MFC.
  char* m_pszData;

 private:
  struct Header {
    int len;
    int cap;
  };
  Header* hdr() const { return reinterpret_cast<Header*>(m_pszData) - 1; }
  void init(const char* s, int n);
  void reserve(int n);
  void set(const char* s, int n);
  void append(const char* s, int n);
};

CString operator+(const CString& a, const CString& b);
CString operator+(const CString& a, const char* b);
CString operator+(const char* a, const CString& b);
CString operator+(const CString& a, char b);
CString operator+(char a, const CString& b);

inline bool operator==(const CString& a, const CString& b) { return strcmp(a, b) == 0; }
inline bool operator==(const CString& a, const char* b) { return strcmp(a, b) == 0; }
inline bool operator==(const char* a, const CString& b) { return strcmp(a, b) == 0; }
inline bool operator==(const CString& a, char* b) { return strcmp(a, b) == 0; }
inline bool operator==(char* a, const CString& b) { return strcmp(a, b) == 0; }
inline bool operator!=(const CString& a, const CString& b) { return strcmp(a, b) != 0; }
inline bool operator!=(const CString& a, const char* b) { return strcmp(a, b) != 0; }
inline bool operator!=(const char* a, const CString& b) { return strcmp(a, b) != 0; }
inline bool operator!=(const CString& a, char* b) { return strcmp(a, b) != 0; }
inline bool operator!=(char* a, const CString& b) { return strcmp(a, b) != 0; }
inline bool operator<(const CString& a, const CString& b) { return strcmp(a, b) < 0; }
inline bool operator<(const CString& a, const char* b) { return strcmp(a, b) < 0; }
inline bool operator>(const CString& a, const CString& b) { return strcmp(a, b) > 0; }
inline bool operator>(const CString& a, const char* b) { return strcmp(a, b) > 0; }
inline bool operator<=(const CString& a, const CString& b) { return strcmp(a, b) <= 0; }
inline bool operator>=(const CString& a, const CString& b) { return strcmp(a, b) >= 0; }

typedef CString CStringA;
