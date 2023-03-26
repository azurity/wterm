import React, { useMemo, useState } from "react";
import { connMan, ModemFn } from "../connection";
import "./ModemBox.css";

interface Props {
    connId: number;
    termId: number;
    direct: "send" | "recv";
    fin: () => void;
}

function ModemBox(props: Props) {
    const [type, setType] = useState<string>("x");
    const [use1k, setUse1k] = useState<boolean>(false);
    const [useCRC, setUseCRC] = useState<boolean>(false);
    const [useCAN, setUseCAN] = useState<boolean>(false);
    const [useG, setUseG] = useState<boolean>(false);

    return (
        <div className="modem-box container">
            <div style={{
                width: '100%',
                display: 'grid',
                gridGap: '8px',
                gridTemplateColumns: '16px auto',
            }}>
                <input type="radio" name="protocol" value="x" onChange={() => { setType('x') }} checked={type == "x"} />
                <label>XModem</label>
                <input type="radio" name="protocol" value="y" onChange={() => { setType('y') }} checked={type == "y"} />
                <label>YModem</label>
                <label>&nbsp;</label>
                <label>&nbsp;</label>
                <input type="checkbox" name="1k" onChange={() => { setUse1k(!use1k) }} checked={use1k || type == 'y'} disabled={type == 'y'} />
                <label>1K block</label>
                <input type="checkbox" name="CRC" onChange={() => { setUseCRC(!useCRC) }} checked={useCRC || type == 'y'} disabled={type == 'y'} />
                <label>CRC</label>
                <input type="checkbox" name="CANbreak" onChange={() => { setUseCAN(!useCAN) }} checked={useCAN || type == 'y'} disabled={type == 'y'} />
                <label>double CAN break</label>
                <input type="checkbox" name="g" onChange={() => { setUseG(!useG) }} checked={useG && type == 'y'} disabled={type != 'y'} />
                <label>g-option</label>
            </div>
            <div className="button-group">
                <div onClick={props.fin}>cancel</div>
                <div onClick={() => {
                    let fn = 0;
                    if (use1k) fn |= ModemFn.ModemFn1k;
                    if (useCRC) fn |= ModemFn.ModemFnCRC;
                    if (useCAN) fn |= ModemFn.ModemFnCANCAN;
                    if (useG) fn |= ModemFn.ModemFnG;
                    connMan.get(props.connId)?.modem(props.termId, props.direct, type, fn);
                    props.fin();
                }}>{props.direct}</div>
            </div>
        </div>
    );
}

export default ModemBox;
