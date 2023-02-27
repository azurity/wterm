package ui

import (
	_ "embed"
	"fyne.io/systray"
	"os"
	"os/signal"
	"syscall"
)

//go:embed icon.png
var icon []byte

func StartSystray(launchFn func(), closeFn func()) {
	go systray.Run(func() {
		systray.SetTemplateIcon(icon, icon)
		systray.SetTitle("wterm")
		systray.SetTooltip("wterm")
		show := systray.AddMenuItem("show", "")
		quit := systray.AddMenuItem("quit", "")
		sig := make(chan os.Signal)
		signal.Notify(sig, syscall.SIGTERM, os.Interrupt, os.Kill)
		go func() {
			for {
				select {
				case <-show.ClickedCh:
					launchFn()
					break
				case <-quit.ClickedCh:
					systray.Quit()
					closeFn()
					break
				case <-sig:
					systray.Quit()
					closeFn()
					break
				}
			}
		}()
		launchFn()
	}, func() {})
}
