// Oracle shim for "CFileLib\\CFileLib.h". The project defines _NO_ZLIB, so
// the zip library is never used; only the type name is needed.
#pragma once
#include "fq_win32.h"
class CFL;
class CFileLib {
 public:
  CFL* GetCFL() { return 0; }
  bool UnzipFileToMemory(const char*, void**, int, unsigned long*) { return false; }
};
