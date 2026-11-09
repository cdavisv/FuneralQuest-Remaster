# legacy-town fixture

`system.dat`, `data/config.dat` and `data/player.dat` were written by the ORIGINAL server's own
save code (`file_sys_save`, `file_config_save`, `player_save`, `legacy/source`, unmodified),
compiled 32-bit by the oracle's toolchain (`tools/oracle`, `pnpm --filter @fq/oracle run build`)
and driven by `make-fixtures.cpp` in this folder, which fills four players and the town settings
and then reads the files back with the original `player_load`.

To regenerate (needs the oracle built, `g++ -m32`):

    O=tools/oracle; B=$O/build
    INC="-I$O/cpp/shim/include -I$B/shim-case -I$B/mirror -I$B/mirror/shared"
    g++ -m32 -msse2 -mfpmath=sse -O0 -fpermissive -fshort-wchar -fwrapv -fno-strict-aliasing \
      -fsigned-char -std=gnu++98 -w -DWIN32 -DNDEBUG -D_WINDOWS -D_NO_ZLIB -D_CRT_SECURE_NO_DEPRECATE=1 \
      -DWINVER=0x0501 -D_USE_32BIT_TIME_T -D_WIN32_WINNT=0x501 -D_NO_SECURITY -D_AFXDLL $INC \
      -include $O/cpp/shim/include/fq_win32.h -x c++ -c make-fixtures.cpp -o mk.o
    g++ -m32 mk.o $(ls $B/obj32/*.o | grep -v harness_oracle_main) -o mk -lm && ./mk

The oracle's file shim writes into /tmp/fq-oracle-scratch (`system.dat`, `data/config.dat`,
`data/player.dat`); copy them here. Contents: slot 0 Mort (day 42, tournament on), slot 1 Ana,
slot 2 a Windows-1252 name, slot 3 deleted.
