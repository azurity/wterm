import React, { useEffect, useMemo, useRef, useState } from 'react';
import DockLayout, { BoxBase, DockContext, DropDirection, LayoutBase, LayoutData, PanelBase, PanelData, TabBase, TabData } from 'rc-dock';
import "rc-dock/dist/rc-dock-dark.css";
// import logo from './logo.svg';
import './App.css';
import Menu from './components/Menu';
import Status from './components/Status';
import { standardLayout, walkLayout } from './layout';
import Term from './components/Term';
import { Connection, connMan, FSHandle } from './connection';
import Session from './components/Session';
import { SessionInfo, SettingsType, StatusItem } from './struct';
import AuthBox from './components/AuthBox';
import ConfigBox from './components/ConfigBox';
import List from './components/List';
import FS from './components/FS';
import Settings from './components/Settings';

const groups = {
  tool: {
    floatable: false,
    animated: false,
  },
  terminal: {
    floatable: false,
    maximizable: true,
    animated: false,
  },
}

const overlayGroups = {
  common: {
    floatable: true,
    disableDock: true,
    maximizable: false,
  },
}

const layoutStyle = (custom: boolean) => {
  return {
    position: 'fixed',
    top: (2 + (custom ? 32 : 24)),
    left: 2,
    right: 2,
    bottom: (2 + 20),
  } as React.CSSProperties;
};

function StatusList(data: StatusItem[]) {
  return (
    <List list={data.map((it) => {
      let text = `[${it.type == 'ERROR' ? 'ERROR' : 'INFO '} ${new Date(it.time).toLocaleString()}] ${it.info}`;
      return {
        key: `status-${text}`,
        title: text,
      };
    })} />
  );
}

function App() {
  const custom = useMemo(() => {
    let queries = new Map(document.location.search.replace('?', '').split('&').map((it) => [...it.split('='), ''].slice(0, 2)) as [string, string][]);
    return queries.has('custom');
  }, []);
  const dockRef = useRef<DockLayout>(null);
  const overlayDockRef = useRef<DockLayout>(null);
  const refSets = useMemo<Map<string, React.RefObject<Term>>>(() => new Map(), []);

  const [overlay, setOverlay] = useState<number>(0);

  const [statusList, setStatusList] = useState<StatusItem[]>([]);

  useEffect(() => {
    dockRef.current?.updateTab('status', { id: 'status', title: 'status', content: StatusList(statusList) });
  }, [statusList]);

  const [newStatus, setNewStatus] = useState<StatusItem>();
  useEffect(() => {
    if (newStatus) {
      setStatusList([newStatus, ...statusList]);
    }
  }, [newStatus]);
  const addStatus = (item: StatusItem) => {
    setNewStatus(item);
  }

  const [settings, setSettings] = useState<SettingsType>();

  const refreshSettings = async () => {
    try {
      let res = await fetch('http://localhost:32300/api/settings');
      let data = await res.json();
      setSettings(data);
    } catch (err: any) {
      addStatus({
        type: 'ERROR',
        time: Date.now(),
        info: `[load settings] ${err}`,
      });
    }
  };

  useEffect(() => { refreshSettings(); }, []);

  const newTerm = (name: string, conn: number) => {
    let mainpanel = dockRef.current?.find('main');
    let ref = React.createRef<Term>();
    let localIndex = connMan.get(conn)!.sessionCount;
    let key = `term-${conn}-${localIndex}`;
    dockRef.current?.dockMove({
      id: key,
      title: `${name}${localIndex != 0 ? ` - ${(localIndex + 1)}` : ''}`,
      content: <Term
        key={key}
        ref={ref}
        options={{
          allowProposedApi: true,
          fontFamily: "PureNerdFont, " + (settings?.fontFamily ?? "monospace")
        }}
        connId={conn}
        dispose={() => {
          dockRef.current?.dockMove(dockRef.current?.find(key) as TabData, null, 'remove');
          refSets.delete(key);
        }}
        created={() => {
          // try open fs.
          let sftpId = connMan.get(conn)!.newSftp();
          connMan.get(conn)!.sftphandles.set(localIndex, new FSHandle(connMan.get(conn)!, sftpId));
          updateFS(conn, localIndex);
        }}
      />,
      group: 'terminal',
      closable: true,
      cached: true,
    }, mainpanel as PanelData, 'middle');
    refSets?.set(key, ref);
  }

  const openSession = (info: SessionInfo) => {
    if (!connMan.has(info.id)) {
      let conn = new Connection(info.url, info.protocol, () => {
        newTerm(info.name, info.id);
      }, () => {
        connMan.delete(info.id);
      });
      conn.addEventListener('info', (event) => {
        addStatus({
          type: event.data.type,
          time: Date.now(),
          info: `[${info.name}] ${event.data.info}`,
        } as StatusItem);
      });
      connMan.set(info.id, conn);
      conn.addEventListener('auth', (event) => {
        setOverlay(overlay + 1);
        overlayDockRef.current?.dockMove({
          id: `auth-${info.id}`,
          title: `${event.data} <${info.name}>`,
          content: <AuthBox
            secret={event.data == 'password'}
            submit={(password) => {
              overlayDockRef.current?.dockMove(overlayDockRef.current.find(`auth-${info.id}`) as TabData, null, 'remove');
              setOverlay(overlay - 1);
              conn.auth(event.data, password, false);
            }}
            cancel={() => {
              let key = `term-${info.id}-0`;
              dockRef.current?.dockMove(dockRef.current?.find(key) as TabData, null, 'remove');
              // refSets.delete(key);
              setOverlay(overlay - 1);
            }}
          />,
          // cached: true,
          group: 'common',
        }, null, 'float');
      });
    } else {
      newTerm(info.name, info.id);
    }
  }

  const updateSession = () => {
    let newTab = { ...dockRef.current?.find('session_man') as TabData };
    newTab.content = <Session
      open={openSession}
      edit={editConfig}
      del={delConfig}
      trigger={Date.now()}
      addStatus={addStatus}
    />;
    dockRef.current?.updateTab('session_man', newTab);
  }

  const openSettings = () => {
    if (overlay > 0) {
      return;
    }
    setOverlay(overlay + 1);
    overlayDockRef.current?.dockMove({
      tabs: [{
        id: 'settings',
        title: 'settings',
        content: <Settings
          settings={settings!}
          cancel={() => {
            dockRef.current?.dockMove(dockRef.current?.find('settings') as TabData, null, 'remove');
            setOverlay(overlay - 1);
          }}
          save={async (data) => {
            dockRef.current?.dockMove(dockRef.current?.find('settings') as TabData, null, 'remove');
            setOverlay(overlay - 1);
            try {
              let res = await fetch('http://localhost:32300/api/settings', {
                method: 'POST',
                body: JSON.stringify(data),
              });
              await refreshSettings();
            } catch (err: any) {
              addStatus({
                type: 'ERROR',
                time: Date.now(),
                info: `[save settings] ${err}`,
              });
            }
          }}
        />,
        group: 'common',
        minHeight: 400,
        minWidth: 600,
      }],
      w: 640,
      h: 480,
      y: 120,
    }, null, 'float');
  }

  const cancelConfig = () => {
    overlayDockRef.current?.dockMove(overlayDockRef.current.find('config') as TabData, null, 'remove');
    setOverlay(overlay - 1);
  }

  const openConfig = (id: number, data: any) => {
    if (overlay > 0) {
      return;
    }
    setOverlay(overlay + 1);
    overlayDockRef.current?.dockMove({
      tabs: [{
        id: 'config',
        title: 'config',
        content: <ConfigBox
          infoId={id}
          infoType={data.type}
          initData={data}
          cancel={cancelConfig}
          create={async (conf: any) => {
            try {
              await fetch(`http://localhost:32300/api/config`, {
                method: 'POST',
                body: JSON.stringify(conf),
              });
              updateSession();
            } catch (err: any) {
              addStatus({
                type: 'ERROR',
                time: Date.now(),
                info: `[create session config] ${err}`,
              });
            }
            cancelConfig();
          }}
          update={async (id: number, conf: any) => {
            try {
              await fetch(`http://localhost:32300/api/config?id=${id}`, {
                method: 'POST',
                body: JSON.stringify(conf),
              });
              updateSession();
            } catch (err: any) {
              addStatus({
                type: 'ERROR',
                time: Date.now(),
                info: `[update session config] ${err}`,
              });
            }
            cancelConfig();
          }}
        />,
        // cached: true,
        group: 'common',
        minHeight: 400,
        minWidth: 600,
      }],
      w: 640,
      h: 480,
      y: 120,
    }, null, 'float');
  }

  const newConfig = () => {
    openConfig(-1, {});
  }

  const editConfig = async (id: number) => {
    try {
      let res = await fetch(`http://localhost:32300/api/config?id=${id}`);
      let data = await res.json();
      openConfig(id, data);
    } catch (err: any) {
      addStatus({
        type: 'ERROR',
        time: Date.now(),
        info: `[get session config] ${err}`,
      });
    }
  }

  const delConfig = async (id: number) => {
    try {
      let res = await fetch(`http://localhost:32300/api/config?id=${id}`, {
        method: 'DELETE',
      });
      updateSession();
    } catch (err: any) {
      addStatus({
        type: 'ERROR',
        time: Date.now(),
        info: `[delete session config] ${err}`,
      });
    }
  }

  const updateFS = (connId: number, ssId: number) => {
    dockRef.current?.updateTab("file_man", {
      id: "file_man",
      title: "file manager",
      content: <FS connId={connId} termId={ssId} />,
      group: "tool",
    });
  }

  const dockChange = (newLayout: LayoutBase, currentTabId?: string, direction?: DropDirection) => {
    // resize
    let mainPanel = dockRef.current?.find('main') as PanelData;
    if (mainPanel.activeId) {
      refSets?.get(mainPanel.activeId)?.current?.resize();
    }
    //
    if (direction == "remove") {
      if (refSets?.has(currentTabId!)) {
        refSets?.get(currentTabId!)!.current?.dispose();
        refSets.delete(currentTabId!);
      }
      if (refSets.size == 0) {
        setTimeout(() => {
          updateFS(-1, 0);
        }, 0);
      }
    } else if (direction == "active") {
      if (currentTabId!.slice(0, 4) == "term" && refSets?.has(currentTabId!)) {
        setTimeout(() => {
          updateFS(refSets?.get(currentTabId!)!.current!.connId, refSets?.get(currentTabId!)!.current!.ssId);
        }, 0);
      }
    }
  }

  const loadTab = (it: TabBase) => {
    switch (it.id) {
      case 'file_man':
        return {
          id: "file_man",
          title: "file manager",
          content: <FS connId={-1} termId={0} />,
          group: "tool",
        };
      case 'session_man':
        return {
          id: "session_man",
          title: "session list",
          content: <Session
            open={openSession}
            edit={editConfig}
            del={delConfig}
            addStatus={addStatus}
          />,
          group: "tool",
        };
      case 'history':
        return {
          id: "history",
          title: "histroy cmd",
          content: <div>HISTORY</div>,
          group: "tool",
          cached: true,
        };
      case 'status':
        return {
          id: 'status',
          title: 'status',
          content: StatusList(statusList),
        };
      default:
        return it as TabData;
    }
  }

  // const layout = standardLayout();

  const updateLayout = (layout: LayoutBase) => {
    let terms = [] as TabData[];
    walkLayout(dockRef.current?.getLayout().dockbox, (panel: PanelBase) => {
      terms.push(...(panel as PanelData).tabs.filter((it) => {
        return it.id?.slice(0, 4) == "term";
      }));
    });
    walkLayout(dockRef.current?.getLayout().maxbox, (panel: PanelBase) => {
      terms.push(...(panel as PanelData).tabs.filter((it) => {
        return it.id?.slice(0, 4) == "term";
      }));
    });
    dockRef.current?.loadLayout(layout);
    for (let tab of terms) {
      dockRef.current?.dockMove(tab, dockRef.current?.find('main') as PanelData, 'middle');
    }
    if (terms.length > 0) {
      let lastTerm = terms[terms.length - 1];
      updateFS(refSets?.get(lastTerm.id!)!.current!.connId, refSets?.get(lastTerm.id!)!.current!.ssId);
    }
  }

  const resetLayout = () => {
    if (overlay > 0) {
      addStatus({
        type: 'ERROR',
        time: Date.now(),
        info: `[save layout] cannot save layout when any modal is opened.`,
      });
      return;
    }
    updateLayout(standardLayout());
  }

  const loadLayout = async () => {
    try {
      let res = await fetch('http://localhost:32300/api/layout');
      let data = await res.text();
      if (data != "") {
        updateLayout(JSON.parse(data));
      }
    } catch (err: any) {
      addStatus({
        type: 'ERROR',
        time: Date.now(),
        info: `[load layout] ${err}`,
      });
    }
  }

  const saveLayout = async () => {
    if (overlay > 0) {
      addStatus({
        type: 'ERROR',
        time: Date.now(),
        info: `[save layout] cannot save layout when any modal is opened.`,
      });
      return;
    }
    try {
      let layout = dockRef.current?.saveLayout();
      const processor = function (panel: PanelBase) {
        panel.tabs = panel.tabs.filter((it) => {
          return it.id?.slice(0, 4) != "term";
        });
      }
      walkLayout(layout?.dockbox, processor);
      walkLayout(layout?.maxbox, processor);
      await fetch('http://localhost:32300/api/layout', {
        method: 'POST',
        body: JSON.stringify(layout),
      });
    } catch (err: any) {
      addStatus({
        type: 'ERROR',
        time: Date.now(),
        info: `[save layout] ${err}`,
      });
    }
  }

  useEffect(() => {
    loadLayout();
  }, []);

  return (
    <div>
      <Menu
        width={80}
        custom={custom}
        style={{ zIndex: 1 }}
        top={true}
        desc={[
          {
            title: "session",
            width: 120,
            children: [
              {
                title: "new session",
                action: newConfig,
              },
              {
                title: "settings",
                action: openSettings,
              },
            ]
          },
          {
            title: "layout",
            width: 120,
            children: [
              {
                title: "load layout",
                action: loadLayout,
              },
              {
                title: "save layout",
                action: saveLayout,
              },
              {
                title: "reset layout",
                action: resetLayout,
              }
            ],
          },
        ]} />
      <DockLayout
        ref={dockRef}
        defaultLayout={standardLayout()}
        loadTab={loadTab}
        onLayoutChange={dockChange}
        groups={groups}
        style={layoutStyle(custom)}
      />
      <div className='overlay' style={{ visibility: overlay > 0 ? 'visible' : 'hidden' }}>
        <DockLayout
          ref={overlayDockRef}
          defaultLayout={{
            dockbox: {
              mode: "vertical",
              children: []
            }
          }}
          groups={overlayGroups}
          style={layoutStyle(custom)}
        />
      </div>
      <Status list={statusList} />
    </div>
  );
  // return (
  //   <div className="App">
  //     <header className="App-header">
  //       <img src={logo} className="App-logo" alt="logo" />
  //       <p>
  //         Edit <code>src/App.tsx</code> and save to reload.
  //       </p>
  //       <a
  //         className="App-link"
  //         href="https://reactjs.org"
  //         target="_blank"
  //         rel="noopener noreferrer"
  //       >
  //         Learn React
  //       </a>
  //     </header>
  //   </div>
  // );
}

export default App;
