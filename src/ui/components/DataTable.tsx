import './DataTable.css';

export interface Column<T> {
    header: string;
    accessor: keyof T | ((item: T) => React.ReactNode);
    className?: string;
}

interface Action<T> {
    icon: React.ElementType;
    onClick: (item: T) => void;
    className?: string; // Para colores (text-danger, etc)
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    actions?: Action<T>[];
    keyExtractor: (item: T) => string | number;
}

export function DataTable<T>({ columns, data, actions, keyExtractor }: DataTableProps<T>) {
    return (
        <div className="table-container">
            <table className="data-table">
                <thead>
                    <tr>
                        {columns.map((col, idx) => (
                            <th key={idx} className={col.className}>{col.header}</th>
                        ))}
                        {actions && <th className="actions-header">Acciones</th>}
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length + (actions ? 1 : 0)} className="empty-state">
                                No hay datos disponibles
                            </td>
                        </tr>
                    ) : (
                        data.map((item) => (
                            <tr key={keyExtractor(item)}>
                                {columns.map((col, idx) => (
                                    <td key={idx} className={col.className}>
                                        {typeof col.accessor === 'function'
                                            ? col.accessor(item)
                                            : (item[col.accessor] as React.ReactNode)}
                                    </td>
                                ))}
                                {actions && (
                                    <td className="actions-cell">
                                        {actions.map((action, idx) => {
                                            const Icon = action.icon;
                                            return (
                                                <button
                                                    key={idx}
                                                    className={`action-btn ${action.className || ''}`}
                                                    onClick={() => action.onClick(item)}
                                                >
                                                    <Icon size={18} />
                                                </button>
                                            );
                                        })}
                                    </td>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
