import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../logic/authContext';
import { LayoutDashboard, Users, ClipboardCheck, DollarSign, Clock, FileBarChart, LogOut, Settings, Tag, Package } from 'lucide-react';
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
    { label: 'Inventario', path: '/products', icon: Package },
];

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAdmin, logout } = useAuth();

    const filteredNavItems = NAV_ITEMS.filter(item => {
        if (isAdmin) return true;
        // Collaborator restricted items
        const restricted = ['/reports', '/plans', '/settings'];
        return !restricted.includes(item.path);
    });

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleNavClick = () => {
        // Close sidebar on mobile when navigating
        if (onClose) onClose();
    };

    return (
        <aside className={clsx('sidebar', { open: isOpen })}>
            <div className="sidebar-header">
                <h1 className="brand-logo">BFIT<span style={{ color: 'var(--color-accent)' }}>control</span></h1>
            </div>

            <nav className="sidebar-nav">
                {filteredNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={clsx('nav-item', { active: isActive })}
                            onClick={handleNavClick}
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                {isAdmin && (
                    <Link to="/settings" className="nav-item">
                        <Settings size={20} />
                        <span>Configuración</span>
                    </Link>
                )}
                <button className="logout-btn" onClick={handleLogout}>
                    <LogOut size={20} />
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
}

