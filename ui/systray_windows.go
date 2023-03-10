package ui

import (
	_ "embed"
	"github.com/getlantern/systray"
)

//go:embed icon.ico
var icon []byte

func StartSystray(launchFn func(), closeFn func()) {
	go systray.Run(func() {
		systray.SetTemplateIcon(icon, icon)
		systray.SetTitle("wterm")
		systray.SetTooltip("wterm")
		show := systray.AddMenuItem("show", "")
		quit := systray.AddMenuItem("quit", "")
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
				}
			}
		}()
		launchFn()
	}, func() {})
}
