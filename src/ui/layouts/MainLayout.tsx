import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Bell, Search } from 'lucide-react';
import './Layout.css';

function Topbar() {
    return (
        <header className="topbar">
            <div className="search-bar">
                <Search size={18} color="var(--color-text-secondary)" />
                <input type="text" placeholder="Buscar..." />
            </div>

            <div className="topbar-actions">
                <button className="icon-btn">
                    <Bell size={20} />
                    <span className="notification-dot"></span>
                </button>
                <div className="user-profile">
                    <div className="avatar">A</div>
                    <div className="user-info">
                        <span className="name">Admin</span>
                        <span className="role">Super Admin</span>
                    </div>
                </div>
            </div>
        </header>
    );
}

export function MainLayout() {
    return (
        <div className="main-layout">
            <Sidebar />
            <div className="content-wrapper">
                <Topbar />
                <main className="page-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
