/**
 * The page that plays welcome.swf under Ruffle, self-hosted (no CDN).
 *
 * The movie asks for `request.xp?...` and `flash/...` relative to the page, as
 * a browser plug-in did, so the page sets `<base>` to where the bridge is
 * mounted and Ruffle's `base` option to the same place.
 */
export function rufflePage(basePath: string): string {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<base href="${base}">
<title>Funeral Quest (original 2001 client)</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body { margin: 0; height: 100%; background: #000; color: #c9b27c; font-family: Georgia, serif; }
  #stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
  #player { width: min(100vw, 133.34vh); height: min(75vw, 100vh); }
  #note { position: fixed; left: 0; right: 0; bottom: 0; padding: 2px 8px; font-size: 11px; text-align: center; background: rgba(0,0,0,.6); }
  #note a { color: #FF9900; }
</style>
<script>
  window.RufflePlayer = window.RufflePlayer || {};
  window.RufflePlayer.config = {
    publicPath: "ruffle/",
    autoplay: "on",
    unmuteOverlay: "hidden",
    splashScreen: false,
    letterbox: "on",
    warnOnUnsupportedContent: false,
    contextMenu: "off",
    base: document.baseURI,
  };
</script>
<script src="ruffle/ruffle.js"></script>
</head>
<body>
<div id="stage"><div id="player"></div></div>
<div id="note">Museum mode: the unmodified 2001 Flash client, played with Ruffle against the FuneralQuest Remastered engine.</div>
<script>
  window.addEventListener("load", function () {
    var ruffle = window.RufflePlayer.newest();
    var player = ruffle.createPlayer();
    player.style.width = "100%";
    player.style.height = "100%";
    document.getElementById("player").appendChild(player);
    window.fqPlayer = player;
    player.load({ url: "flash/welcome.swf", base: document.baseURI });
  });
</script>
</body>
</html>
`;
}
