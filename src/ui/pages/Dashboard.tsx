import { useAuth } from '../../logic/authContext';
import AdminDashboard from './AdminDashboard';
import { CollabDashboard } from './CollabDashboard';

export default function Dashboard() {
    const { isAdmin } = useAuth();

    if (isAdmin) {
        return <AdminDashboard />;
    }

    return <CollabDashboard />;
}
