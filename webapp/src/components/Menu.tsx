import "./Menu.css";

interface MenuBase {
    title: string;
}

export type MenuList = MenuBase & {
    width?: number,
    children: (MenuList | MenuItem)[];
}

export type MenuItem = MenuBase & {
    action: () => void;
}

interface MenuProps {
    top?: boolean;
    style?: React.CSSProperties
    desc: (MenuList | MenuItem)[];
}

function Menu(props: MenuProps) {

    return (
        <div className={"menu " + (props.top ? "top" : "")} style={props.style ?? {}}>{
            props.desc.map((item: MenuList | MenuItem) => (
                <div key={item.title} className="menu-item" onClick={(event) => {
                    if ((item as MenuItem).action) {
                        (item as MenuItem).action();
                    }
                }}>
                    {item.title}
                    {(item as MenuList).children != undefined ? <Menu
                        desc={(item as MenuList).children}
                        style={
                            Object.assign({
                                display: 'none',
                                width: (item as MenuList).width ?? 80,
                            }, props.top ? { left: 0, top: 24 } : { left: (props.style?.width ?? 80) as number - 2, top: -1 })
                        }
                    /> : ''}
                </div>
            ))
        }</div>
    );
}

export default Menu;
