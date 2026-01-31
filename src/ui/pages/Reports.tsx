import { useEffect, useState } from 'react';
import { getPayments } from '../../logic/api/financeService';
import { getMembers } from '../../logic/api/memberService';
import type { Payment } from '../../domain/types';
import { BarChart, PieChart, TrendingUp, Calendar } from 'lucide-react';

export default function Reports() {
    const [loading, setLoading] = useState(true);
    const [totalIncome, setTotalIncome] = useState(0);
    const [paymentMethods, setPaymentMethods] = useState<Record<string, number>>({});
    const [activeMembers, setActiveMembers] = useState(0);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [payments, members] = await Promise.all([
            getPayments(),
            getMembers()
        ]);

        // Calc Income
        const total = payments.reduce((sum, p) => sum + p.total, 0);
        setTotalIncome(total);

        // Calc Methods
        const methods = payments.reduce((acc, p) => {
            acc[p.metodo_pago] = (acc[p.metodo_pago] || 0) + p.total;
            return acc;
        }, {} as Record<string, number>);
        setPaymentMethods(methods);

        // Calc Members (Active Subscriptions)
        setActiveMembers(members.filter(m => m.subscriptionStatus === 'activa').length);

        setLoading(false);
    };

    if (loading) return <div className="page-container">Generando reportes...</div>;

    return (
        <div className="page-container">
            <h2>Reportes y Métricas</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-lg)' }}>

                {/* Income Card */}
                <div style={{ backgroundColor: 'var(--color-card)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-lg)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--spacing-lg)' }}>
                        <TrendingUp color="var(--color-success)" /> Ingresos Totales
                    </h3>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                        ${totalIncome.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                        Histórico acumulado
                    </p>
                </div>

                {/* Methods Card */}
                <div style={{ backgroundColor: 'var(--color-card)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-lg)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--spacing-lg)' }}>
                        <PieChart color="var(--color-accent)" /> Desglose por Método
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {Object.entries(paymentMethods).map(([method, amount]) => (
                            <div key={method} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ textTransform: 'capitalize' }}>{method}</span>
                                <b>${amount.toLocaleString()}</b>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Members KPI */}
                <div style={{ backgroundColor: 'var(--color-card)', padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-lg)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 'var(--spacing-lg)' }}>
                        <BarChart color="var(--color-warning)" /> Membresías
                    </h3>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                        {activeMembers}
                    </div>
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                        Miembros Activos
                    </p>
                </div>
            </div>
        </div>
    );
}
