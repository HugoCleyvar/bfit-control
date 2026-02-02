import { useState, useEffect, useRef } from 'react';
import { Search, User, X, Loader } from 'lucide-react';
import type { MemberWithStatus } from '../../logic/api/memberService';
import { searchMembers } from '../../logic/api/memberService';

interface MemberSearchProps {
    onSelect: (memberId: string, member?: MemberWithStatus) => void;
    placeholder?: string;
}

export function MemberSearch({ onSelect, placeholder = "Buscar miembro..." }: MemberSearchProps) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<MemberWithStatus | null>(null);
    const [results, setResults] = useState<MemberWithStatus[]>([]);
    const [loading, setLoading] = useState(false);

    // Debounce ref
    const timeoutRef = useRef<number | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const handleSearch = (text: string) => {
        setQuery(text);
        setIsOpen(true);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (!text) {
            setResults([]);
            return;
        }

        setLoading(true);
        timeoutRef.current = window.setTimeout(async () => {
            const data = await searchMembers(text);
            setResults(data);
            setLoading(false);
        }, 500); // 500ms debounce
    };

    const handleSelect = (member: MemberWithStatus) => {
        setSelectedMember(member);
        setQuery('');
        setIsOpen(false);
        setResults([]);
        onSelect(member.id, member);
    };

    const clearSelection = () => {
        setSelectedMember(null);
        setQuery('');
        onSelect('');
    };

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    if (selectedMember) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid var(--color-success)',
                borderRadius: 'var(--radius-md)',
                color: 'white'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <User size={16} />
                    </div>
                    <span>{selectedMember.nombre} {selectedMember.apellido}</span>
                </div>
                <button
                    type="button"
                    onClick={clearSelection}
                    style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer' }}
                >
                    <X size={18} />
                </button>
            </div>
        );
    }

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'gray' }} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    style={{
                        width: '100%',
                        padding: '10px 10px 10px 35px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text-primary)',
                        fontSize: 'var(--font-size-md)'
                    }}
                />
                {loading && (
                    <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                        <Loader size={16} className="animate-spin" />
                    </div>
                )}
            </div>

            {isOpen && query.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '100%', left: 0, right: 0,
                    backgroundColor: '#1f2937', // dark-gray-800
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '4px',
                    zIndex: 100,
                    maxHeight: '250px',
                    overflowY: 'auto',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    {!loading && results.length === 0 ? (
                        <div style={{ padding: '10px', color: 'gray', textAlign: 'center' }}>No encontrado</div>
                    ) : (
                        results.map(member => (
                            <div
                                key={member.id}
                                onClick={() => handleSelect(member)}
                                style={{
                                    padding: '10px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #374151',
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    backgroundColor: '#4b5563', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <span style={{ fontSize: '12px' }}>{member.nombre[0]}</span>
                                </div>
                                <div>
                                    <div style={{ color: 'white' }}>{member.nombre} {member.apellido}</div>
                                    <div style={{ fontSize: '12px', color: 'gray' }}>{member.estatus === 'activo' ? '🟢 Activo' : '🔴 Inactivo'}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
