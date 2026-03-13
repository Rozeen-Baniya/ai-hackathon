// Update 2
// Update 1
import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Layers, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

export const Variants = () => {
    const [variants, setVariants] = useState([]);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentVariant, setCurrentVariant] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 12;

    const [formData, setFormData] = useState({
        product_id: '',
        size: '',
        color: '',
        material: '',
        stock_quantity: 0,
        price_adjustment: 0,
        sku: ''
    });

    useEffect(() => {
        fetchVariants();
        fetchProducts();
    }, [page, searchTerm]);

    const fetchVariants = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('product_variants')
                .select('*, products(name, brand)', { count: 'exact' });

            if (searchTerm) {
                // Search by SKU or product name
                query = query.or(`sku.ilike.%${searchTerm}%,product_id.in.(select id from products where name.ilike.%${searchTerm}%)`);
            }

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range((page - 1) * pageSize, page * pageSize - 1);

            if (error) throw error;
            setVariants(data || []);
        } catch (error) {
            console.error('Error fetching variants:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('id, name').order('name');
        setProducts(data || []);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const variantData = {
                ...formData,
                stock_quantity: parseInt(formData.stock_quantity),
                price_adjustment: parseFloat(formData.price_adjustment)
            };

            if (currentVariant) {
                const { error } = await supabase
                    .from('product_variants')
                    .update(variantData)
                    .eq('id', currentVariant.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('product_variants')
                    .insert([variantData]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchVariants();
        } catch (error) {
            alert(error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this variant?')) return;
        try {
            const { error } = await supabase.from('product_variants').delete().eq('id', id);
            if (error) throw error;
            fetchVariants();
        } catch (error) {
            alert(error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Product Variants</h1>
                    <p className="text-slate-500 text-sm">Manage sizes, colors, and stock for your products.</p>
                </div>
                <Button
                    onClick={() => {
                        setCurrentVariant(null);
                        setFormData({ product_id: '', size: '', color: '', material: '', stock_quantity: 0, price_adjustment: 0, sku: '' });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-12 px-6 shadow-lg shadow-blue-200"
                >
                    <Plus size={20} />
                    <span>Add Variant</span>
                </Button>
            </div>

            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by SKU or product..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-12 pl-11 pr-4 bg-slate-50 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {isLoading ? (
                    <div className="col-span-full py-20 text-center text-slate-400">Loading variants...</div>
                ) : variants.map((variant) => (
                    <div key={variant.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 hover:border-blue-100 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                <Layers size={20} />
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => {
                                        setCurrentVariant(variant);
                                        setFormData({
                                            product_id: variant.product_id,
                                            size: variant.size || '',
                                            color: variant.color || '',
                                            material: variant.material || '',
                                            stock_quantity: variant.stock_quantity,
                                            price_adjustment: variant.price_adjustment,
                                            sku: variant.sku || ''
                                        });
                                        setIsModalOpen(true);
                                    }}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(variant.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{variant.products?.name}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{variant.sku || 'No SKU'}</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {variant.size && <span className="px-2 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold">SIZE: {variant.size}</span>}
                                {variant.color && <span className="px-2 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold">COLOR: {variant.color}</span>}
                            </div>

                            <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock</p>
                                    <p className={`font-black ${variant.stock_quantity <= 10 ? 'text-red-600' : 'text-slate-900'}`}>
                                        {variant.stock_quantity} units
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Adjust</p>
                                    <p className="font-black text-emerald-600">
                                        {variant.price_adjustment >= 0 ? '+' : ''}Rs {Number(variant.price_adjustment).toLocaleString('en-IN')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-4 pt-8">
                <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="flex items-center gap-2 px-6 h-12 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
                >
                    <ChevronLeft size={18} />
                    <span>Prev</span>
                </button>
                <span className="font-bold text-slate-400">Page {page}</span>
                <button
                    disabled={variants.length < pageSize}
                    onClick={() => setPage(p => p + 1)}
                    className="flex items-center gap-2 px-6 h-12 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
                >
                    <span>Next</span>
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl relative z-10 overflow-hidden">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-slate-900">{currentVariant ? 'Edit Variant' : 'Add Variant'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-900 ml-1">PRODUCT</label>
                                <select
                                    required
                                    value={formData.product_id}
                                    onChange={e => setFormData(prev => ({ ...prev, product_id: e.target.value }))}
                                    className="w-full h-12 px-4 bg-slate-50 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="">Select Product</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-900 ml-1">SIZE</label>
                                    <input type="text" value={formData.size} onChange={e => setFormData(prev => ({ ...prev, size: e.target.value }))} className="w-full h-12 px-4 bg-slate-50 rounded-2xl border border-slate-200" placeholder="XS, S, M, L, XL" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-900 ml-1">COLOR</label>
                                    <input type="text" value={formData.color} onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))} className="w-full h-12 px-4 bg-slate-50 rounded-2xl border border-slate-200" placeholder="Blue, Black, etc." />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-900 ml-1">SKU</label>
                                    <input type="text" value={formData.sku} onChange={e => setFormData(prev => ({ ...prev, sku: e.target.value }))} className="w-full h-12 px-4 bg-slate-50 rounded-2xl border border-slate-200" placeholder="PROD-SIZE-COLOR" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-900 ml-1">STOCK</label>
                                    <input type="number" required value={formData.stock_quantity} onChange={e => setFormData(prev => ({ ...prev, stock_quantity: e.target.value }))} className="w-full h-12 px-4 bg-slate-50 rounded-2xl border border-slate-200" />
                                </div>
                            </div>

                            <Button type="submit" className="w-full h-14 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 mt-4">
                                {currentVariant ? 'Save Variant' : 'Create Variant'}
                            </Button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
