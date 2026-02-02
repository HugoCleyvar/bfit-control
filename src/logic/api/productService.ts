import { supabase } from './supabase';

export interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
    min_stock: number;
    category: string;
    emoji: string;
    active: boolean;
}

export async function getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name');

    if (error) {
        console.error('Error fetching products:', error);
        return [];
    }
    return data as Product[];
}

export async function createProduct(product: Omit<Product, 'id' | 'active'>): Promise<boolean> {
    const { error } = await supabase
        .from('products')
        .insert({
            ...product,
            active: true
        });

    if (error) {
        console.error('Error creating product:', error);
        return false;
    }
    return true;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<boolean> {
    const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id);

    if (error) {
        console.error('Error updating product:', error);
        return false;
    }
    return true;
}

export async function deleteProduct(id: string): Promise<boolean> {
    // Soft delete
    const { error } = await supabase
        .from('products')
        .update({ active: false })
        .eq('id', id);

    if (error) {
        console.error('Error deleting product:', error);
        return false;
    }
    return true;
}

// Transactional Stock Deduction
// Note: Supabase JS doesn't support complex transactions easily without RPC.
// For MVP, we will do Optimistic Update: Read -> Check -> Update.
// Ideally, use an RPC function `sell_product(id, quantity)` for safety.
export async function processSaleDeduction(productId: string, quantity: number): Promise<{ success: boolean; message?: string }> {
    // 1. Get current stock
    const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('stock, name')
        .eq('id', productId)
        .single();

    if (fetchError || !product) {
        return { success: false, message: 'Producto no encontrado' };
    }

    if (product.stock < quantity) {
        return { success: false, message: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}` };
    }

    // 2. Deduct
    const newStock = product.stock - quantity;
    const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);

    if (updateError) {
        return { success: false, message: 'Error al actualizar inventario' };
    }

    return { success: true };
}
