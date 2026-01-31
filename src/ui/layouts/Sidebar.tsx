import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardCheck, DollarSign, Clock, FileBarChart, LogOut, Settings, Tag } from 'lucide-react';
import clsx from 'clsx';
import './Layout.css'; // We will create this

const NAV_ITEMS = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Usuarios', path: '/members', icon: Users },
    { label: 'Asistencias', path: '/attendance', icon: ClipboardCheck },
    { label: 'Pagos', path: '/payments', icon: DollarSign },
    { label: 'Turnos y Caja', path: '/shifts', icon: Clock },
    { label: 'Reportes', path: '/reports', icon: FileBarChart },
    { label: 'Planes', path: '/plans', icon: Tag },
];

export function Sidebar() {
    const location = useLocation();

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1 className="brand-logo">BFIT<span style={{ color: 'var(--color-accent)' }}>control</span></h1>
            </div>

            <nav className="sidebar-nav">
                {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={clsx('nav-item', { active: isActive })}
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <Link to="/settings" className="nav-item">
                    <Settings size={20} />
                    <span>Configuración</span>
                </Link>
                <button className="logout-btn">
                    <LogOut size={20} />
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
}
