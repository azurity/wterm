import React, { useCallback, useEffect, useRef, useState } from "react";
import "./List.css";
import Menu, { MenuList, MenuItem } from "./Menu";

export interface ListItem {
    key: string;
    title: string;
    icon?: () => JSX.Element;
    select?: (item: ListItem) => void;
    action?: (item: ListItem) => void;
    menu?: (MenuList | MenuItem)[];
    [x: string]: any;
}

interface ListProps {
    itemStyle?: React.CSSProperties;
    list: ListItem[];
}

interface ListItemProps {
    itemStyle?: React.CSSProperties;
    data: ListItem;
}

interface Position {
    x: number;
    y: number;
}

function ListItem(props: ListItemProps) {
    let [menu, setMenu] = useState<boolean>(false);
    let [position, setPosition] = useState<Position>({ x: 0, y: 0 });

    useEffect(() => {
        document.addEventListener('contextmenu', (event) => {
            if ((event.target as HTMLElement).dataset['key'] != props.data.key) {
                setMenu(false);
            }
        });
        document.addEventListener('click', () => {
            setMenu(false);
        });
        window.addEventListener('resize', () => {
            setMenu(false);
        });
    }, []);

    return (
        <div
            data-key={!!props.data.menu ? props.data.key : undefined}
            style={props.itemStyle ?? {}}
            onDoubleClick={(event) => {
                if (props.data.action) {
                    props.data.action(props.data);
                }
            }}
            onClick={(event) => {
                if (props.data.select) {
                    props.data.select(props.data);
                }
            }}
            onContextMenu={(event) => {
                // console.log(event.clientX);
                if (props.data.menu) {
                    event.preventDefault();
                    setMenu(true);
                    setPosition({ x: event.clientX, y: event.clientY });
                }
            }}>
            {!!props.data.icon ? React.createElement(props.data.icon!) : undefined}
            {props.data.title}
            {
                !!props.data.menu && menu ?
                    <div className="menu" style={{ "--mouse-x": `${position.x}px`, "--mouse-y": `${position.y}px` } as any}>
                        <Menu desc={props.data.menu} />
                    </div> : ""
            }
        </div>
    );
}

function List(props: ListProps) {
    return (
        <div className="list">{
            props.list.map((item) => <ListItem key={item.key} data={item} itemStyle={props.itemStyle} />)
        }</div>
    );
}

export default List;
