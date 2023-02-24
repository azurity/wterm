import React, { useMemo, useState } from "react";
import List, { ListItem } from "./List";
import "./ConfigBox.css";
import SSHConfig, { checkSSH, formatSSH } from "./configs/SSHConfig";
import PTYConfig, { checkPTY, formatPTY } from "./configs/PTYConfig";

interface Props {
    infoId: number;
    infoType?: string;
    initData?: any;
    cancel: () => void;
    create?: (conf: any) => void;
    update?: (id: number, conf: any) => void;
}

interface ConfigDetailType {
    Component: (data: any, onChange: (data: any) => void) => React.ReactElement;
    check: (data: any) => boolean;
    format: (data: any) => any;
}

const ConfigDetail: [string, ConfigDetailType][] = [
    ["PTY", { Component: PTYConfig, check: checkPTY, format: formatPTY }],
    ["ssh", { Component: SSHConfig, check: checkSSH, format: formatSSH }],
];

const ConfigDetailMap = new Map([["", { Component: () => <div></div>, check: () => false, format: (data) => data }], ...ConfigDetail]);

function ConfigBox(props: Props) {
    const [type, setType] = useState<string>(props.infoType ?? "");
    const [data, setData] = useState<any>(props.initData ?? {});

    const select = (item: ListItem) => {
        setData({});
        setType(item.key);
    }

    return (
        <div className={["config-box", props.infoId == -1 ? undefined : "edit"].join(' ')}>
            {props.infoId == -1 ?
                <div className="side">
                    <List list={ConfigDetail.map(([name, _]) => {
                        return {
                            key: `config-${name}`,
                            title: name,
                            select,
                        };
                    })} />
                </div> : ''}
            <div className="container">
                {React.createElement(ConfigDetailMap.get(type)!.Component, { data, onChange: setData })}
                <div className="button-group">
                    <div onClick={props.cancel}>cancel</div>
                    {
                        props.infoId == -1 ?
                            <div
                                className={ConfigDetailMap.get(type)!.check(data) ? "" : "disable"}
                                onClick={() => {
                                    if (props.create) {
                                        props.create(ConfigDetailMap.get(type)!.format(data));
                                    }
                                }}>create</div>
                            :
                            <div
                                className={ConfigDetailMap.get(type)!.check(data) ? "" : "disable"}
                                onClick={() => {
                                    if (props.update) {
                                        props.update(props.infoId, ConfigDetailMap.get(type)!.format(data));
                                    }
                                }}>save</div>
                    }
                </div>
            </div>
        </div>
    );
}

export default ConfigBox;

