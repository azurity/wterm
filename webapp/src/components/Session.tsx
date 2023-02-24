import React, { useEffect, useState } from 'react';
import { VscSymbolInterface } from 'react-icons/vsc';
import { SessionInfo, StatusItem } from '../struct';
import List, { ListItem } from './List';

interface SessionProps {
    open: (info: SessionInfo) => void;
    edit: (id: number) => void;
    del: (id: number) => void;
    trigger?: number;
    addStatus: (status: StatusItem) => void;
}

function Session(props: SessionProps) {
    const [infos, setInfos] = useState<SessionInfo[]>([]);

    useEffect(() => {
        (async () => {
            try {
                let res = await fetch('http://localhost:32300/api/config');
                let data = await res.json();
                setInfos(data);
            } catch (err: any) {
                props.addStatus({
                    type: 'ERROR',
                    time: Date.now(),
                    info: `[get session list] ${err}`,
                });
            }
        })();
    }, [props.trigger]);

    const action = (item: ListItem) => {
        if (props.open) {
            props.open(item.data);
        }
    };
    return (
        <List
            itemStyle={{
                display: 'flex',
                justifyContent: 'start',
                alignItems: 'center',
                gap: 8,
            }}
            list={infos.map((it) => ({
                key: `session-${it.id}`,
                title: it.name,
                icon: () => <VscSymbolInterface />,
                data: it,
                action: action,
                menu: [
                    {
                        title: 'edit',
                        action: () => { props.edit(it.id); },
                    }, {
                        title: 'delete',
                        action: () => { props.del(it.id); },
                    },
                ]
            }))} />
    );
}

export default Session;
