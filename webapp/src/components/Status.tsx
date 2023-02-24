import { StatusItem } from "../struct";

interface Props {
    list: StatusItem[];
}

function Status(props: Props) {
    return (
        <div style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 20,
            // background: "rgb(0 102 204)",
            fontSize: 16,
            boxSizing: 'border-box',
            display: 'flex',
        }}>
            <div style={{
                color: 'orange',
                width: 96,
                textAlign: 'center',
                userSelect: 'none',
            }}>ERROR:{props.list.filter((it) => it.type == 'ERROR').length}</div>
            <div style={{
                color: 'gray',
                width: 96,
                textAlign: 'center',
                userSelect: 'none',
            }}>INFO:{props.list.filter((it) => it.type == 'INFO').length}</div>
            {props.list.length > 0 ? <div style={{
                color: props.list[0].type == 'ERROR' ? 'orange' : 'gray',
            }}>{`[${props.list[0].type} ${new Date(props.list[0].time).toLocaleString()}] ${props.list[0].info}`}</div> : ''}
        </div>
    );
}

export default Status;
