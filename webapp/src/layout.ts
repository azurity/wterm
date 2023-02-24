import { BoxBase, LayoutBase, LayoutData, PanelBase, TabData } from "rc-dock";


export function walkLayout(item: BoxBase | PanelBase | undefined, callback: (panel: PanelBase) => void) {
    if (item == undefined) {
        return;
    }
    if ((item as BoxBase).children != undefined) {
        (item as BoxBase).children.map((it) => walkLayout(it, callback));
    } else {
        callback(item as PanelBase);
    }
}

export function standardLayout(): LayoutData {
    return {
        dockbox: {
            mode: "vertical",
            children: [
                {
                    size: 600,
                    mode: "horizontal",
                    children: [
                        {
                            size: 200,
                            tabs: [{ id: 'file_man' } as TabData],
                        },
                        {
                            size: 800,
                            id: "main",
                            panelLock: {},
                            tabs: [],
                        },
                        {
                            size: 200,
                            mode: "vertical",
                            children: [
                                {
                                    tabs: [{ id: 'session_man' } as TabData],
                                },
                                // {
                                //     tabs: [{ id: 'history' } as TabData],
                                // },
                            ],
                        },
                    ],
                },
                {
                    size: 200,
                    panelLock: {},
                    tabs: [{ id: 'status' } as TabData],
                },
            ],
        },
    };
}
