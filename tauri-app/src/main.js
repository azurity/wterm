window.addEventListener("DOMContentLoaded", () => {
  const api = window.__TAURI__;

  if (api != undefined) {
    const { appWindow } = api.window;

    api.cli.getMatches().then((matches) => {
      if (matches.args.app.value) {
        document.getElementById('container').src = matches.args.app.value;
      }
      if (matches.args["title-padding"].value) {
        document.getElementById("titlebar").style.left = matches.args["title-padding"].value;
      }
    });
    document
      .getElementById('titlebar-minimize')
      .addEventListener('click', () => {
        appWindow.minimize();
      });
    document
      .getElementById('titlebar-maximize')
      .addEventListener('click', () => {
        appWindow.isMaximized().then((max) => {
          if (max) {
            document.getElementById("max-icon").src = "/assets/maximize.svg";
          } else {
            document.getElementById("max-icon").src = "/assets/restore.svg";
          }
        });
        appWindow.toggleMaximize();
      });
    document
      .getElementById('titlebar-close')
      .addEventListener('click', () => {
        appWindow.close();
      });
  }
});
