import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    FlatList,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppScreen } from '../components/ui/AppScreen';
import { GlassCard } from '../components/ui/GlassCard';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../theme';
import { supabase } from '../services/supabase';
import {
    Coffee,
    UtensilsCrossed,
    Cookie,
    GlassWater,
    Moon,
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    Upload,
    Clock,
    CheckCircle2,
    XCircle,
    ChefHat,
    Package,
    Star,
    AlertTriangle,
    ArrowLeft,
    CreditCard,
    Loader2,
    Leaf,
    Drumstick,
    Flame,
    History,
    QrCode,
    Copy,
    Check,
    X,
    MessageSquare,
    FileText,
    Sparkles,
    Search,
    Ban,
} from 'lucide-react-native';

type CafeMenuItem = {
    id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    image_url?: string;
    is_available: boolean;
    preparation_time: number;
    allergens?: string[];
    nutritional_info?: any;
};

type CartItem = {
    id: string;
    menu_item: CafeMenuItem;
    quantity: number;
    special_instructions?: string;
};

type CafeOrder = {
    id: string;
    items: CartItem[];
    total_amount: number;
    status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
    created_at: string;
    estimated_ready_time?: string;
};

// Category metadata
const CATEGORY_CONFIG: Record<string, { label: string; icon: any; gradient: [string, string]; time: string }> = {
    breakfast: {
        label: 'Breakfast',
        icon: Coffee,
        gradient: ['#fbbf24', '#f59e0b'],
        time: '8:00 AM - 10:00 AM',
    },
    lunch: {
        label: 'Lunch',
        icon: UtensilsCrossed,
        gradient: ['#10b981', '#059669'],
        time: '12:00 PM - 2:00 PM',
    },
    cool_drinks: {
        label: 'Cool Drinks',
        icon: GlassWater,
        gradient: ['#06b6d4', '#0891b2'],
        time: 'All Day',
    },
    hot_drinks: {
        label: 'Hot Drinks',
        icon: Coffee,
        gradient: ['#f97316', '#ea580c'],
        time: 'All Day',
    },
    fresh_drinks: {
        label: 'Fresh Drinks',
        icon: Leaf,
        gradient: ['#22c55e', '#16a34a'],
        time: 'All Day',
    },
    smoothies: {
        label: 'Smoothies',
        icon: GlassWater,
        gradient: ['#ec4899', '#db2777'],
        time: 'All Day',
    },
    hydrants: {
        label: 'Hydrants',
        icon: GlassWater,
        gradient: ['#0ea5e9', '#0284c7'],
        time: 'All Day',
    },
    dinner: {
        label: 'Dinner',
        icon: Moon,
        gradient: ['#6366f1', '#4f46e5'],
        time: '6:00 PM - 8:00 PM',
    },
    snack: {
        label: 'Snacks',
        icon: Cookie,
        gradient: ['#8b5cf6', '#7c3aed'],
        time: 'All Day',
    },
};

export default function PalmCafeScreen() {
    const [menuItems, setMenuItems] = useState<CafeMenuItem[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orders, setOrders] = useState<CafeOrder[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('breakfast');
    const [isLoading, setIsLoading] = useState(true);
    const [isCafeOpen, setIsCafeOpen] = useState(true);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'orders'>('menu');

    useEffect(() => {
        fetchMenuItems();
        fetchOrders();
        checkCafeStatus();
    }, []);

    const fetchMenuItems = async () => {
        try {
            const { data, error } = await supabase
                .from('cafe_menu_items')
                .select('*')
                .eq('is_available', true)
                .order('category', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;
            setMenuItems(data || []);
        } catch (error) {
            console.error('Error fetching menu items:', error);
            // Fallback demo data
            setMenuItems([
                {
                    id: '1',
                    name: 'Masala Dosa',
                    description: 'Crispy fermented crepe filled with potato masala',
                    price: 45,
                    category: 'breakfast',
                    is_available: true,
                    preparation_time: 15,
                },
                {
                    id: '2',
                    name: 'Filter Coffee',
                    description: 'Traditional South Indian filter coffee',
                    price: 25,
                    category: 'hot_drinks',
                    is_available: true,
                    preparation_time: 5,
                },
            ]);
        }
    };

    const fetchOrders = async () => {
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) return;

            const { data, error } = await supabase
                .from('cafe_orders')
                .select(`
                    *,
                    cafe_order_items (
                        *,
                        cafe_menu_items (*)
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
    };

    const checkCafeStatus = async () => {
        try {
            const { data, error } = await supabase
                .from('cafe_settings')
                .select('is_open')
                .single();

            if (error) throw error;
            setIsCafeOpen(data?.is_open ?? true);
        } catch (error) {
            console.error('Error checking cafe status:', error);
            setIsCafeOpen(true); // Default to open
        }
    };

    const addToCart = (item: CafeMenuItem) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(cartItem => cartItem.menu_item.id === item.id);
            if (existingItem) {
                return prevCart.map(cartItem =>
                    cartItem.menu_item.id === item.id
                        ? { ...cartItem, quantity: cartItem.quantity + 1 }
                        : cartItem
                );
            } else {
                return [...prevCart, {
                    id: `${item.id}-${Date.now()}`,
                    menu_item: item,
                    quantity: 1,
                }];
            }
        });
    };

    const updateCartQuantity = (itemId: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(itemId);
            return;
        }

        setCart(prevCart =>
            prevCart.map(cartItem =>
                cartItem.id === itemId
                    ? { ...cartItem, quantity }
                    : cartItem
            )
        );
    };

    const removeFromCart = (itemId: string) => {
        setCart(prevCart => prevCart.filter(item => item.id !== itemId));
    };

    const getCartTotal = () => {
        return cart.reduce((total, item) => total + (item.menu_item.price * item.quantity), 0);
    };

    const placeOrder = async () => {
        if (cart.length === 0) return;

        setIsPlacingOrder(true);
        try {
            const userResult = await supabase.auth.getUser();
            const user = userResult?.data?.user;
            if (!user) throw new Error('User not authenticated');

            const totalAmount = getCartTotal();

            // Create order
            const { data: orderData, error: orderError } = await supabase
                .from('cafe_orders')
                .insert({
                    user_id: user.id,
                    total_amount: totalAmount,
                    status: 'pending',
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // Create order items
            const orderItems = cart.map(cartItem => ({
                order_id: orderData.id,
                menu_item_id: cartItem.menu_item.id,
                quantity: cartItem.quantity,
                unit_price: cartItem.menu_item.price,
                special_instructions: cartItem.special_instructions,
            }));

            const { error: itemsError } = await supabase
                .from('cafe_order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // Clear cart
            setCart([]);

            // Refresh orders
            fetchOrders();

            Alert.alert('Success', 'Order placed successfully!');

        } catch (error) {
            console.error('Error placing order:', error);
            Alert.alert('Error', 'Failed to place order. Please try again.');
        } finally {
            setIsPlacingOrder(false);
        }
    };

    const filteredMenuItems = menuItems.filter(item => item.category === selectedCategory);
    const cartTotal = getCartTotal();

    const renderCategoryButton = (categoryKey: string) => {
        const config = CATEGORY_CONFIG[categoryKey];
        const IconComponent = config.icon;
        const isSelected = selectedCategory === categoryKey;

        return (
            <TouchableOpacity
                key={categoryKey}
                style={[styles.categoryButton, isSelected ? styles.categoryButtonSelected : null]}
                onPress={() => setSelectedCategory(categoryKey)}
            >
                <LinearGradient
                    colors={config.gradient}
                    style={styles.categoryGradient}
                >
                    <IconComponent size={24} color={COLORS.neutral[50]} />
                    <Text style={styles.categoryLabel}>{config.label}</Text>
                    <Text style={styles.categoryTime}>{config.time}</Text>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const renderMenuItem = ({ item }: { item: CafeMenuItem }) => {
        const cartItem = cart.find(cartItem => cartItem.menu_item.id === item.id);

        return (
            <GlassCard style={styles.menuItemCard}>
                <View style={styles.menuItemHeader}>
                    <View style={styles.menuItemInfo}>
                        <Text style={styles.menuItemName}>{item.name}</Text>
                        <Text style={styles.menuItemDescription} numberOfLines={2}>
                            {item.description}
                        </Text>
                        <View style={styles.menuItemMeta}>
                            <Text style={styles.menuItemPrice}>₹{item.price}</Text>
                            <View style={styles.preparationTime}>
                                <Clock size={14} color={COLORS.neutral[500]} />
                                <Text style={styles.preparationTimeText}>
                                    {item.preparation_time} min
                                </Text>
                            </View>
                        </View>
                    </View>

                    {cartItem ? (
                        <View style={styles.quantityControls}>
                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => updateCartQuantity(cartItem.id, cartItem.quantity - 1)}
                            >
                                <Minus size={16} color={COLORS.primary[600]} />
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>{cartItem.quantity}</Text>
                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => updateCartQuantity(cartItem.id, cartItem.quantity + 1)}
                            >
                                <Plus size={16} color={COLORS.primary[600]} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.addToCartButton}
                            onPress={() => addToCart(item)}
                        >
                            <Plus size={20} color={COLORS.neutral[50]} />
                        </TouchableOpacity>
                    )}
                </View>
            </GlassCard>
        );
    };

    const renderCartItem = ({ item }: { item: CartItem }) => (
        <View style={styles.cartItem}>
            <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName}>{item.menu_item.name}</Text>
                <Text style={styles.cartItemPrice}>
                    ₹{item.menu_item.price} × {item.quantity} = ₹{item.menu_item.price * item.quantity}
                </Text>
            </View>
            <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeFromCart(item.id)}
            >
                <Trash2 size={16} color={COLORS.error[500]} />
            </TouchableOpacity>
        </View>
    );

    const renderOrder = ({ item }: { item: CafeOrder }) => {
        const getStatusColor = (status: string) => {
            switch (status) {
                case 'pending': return COLORS.warning[500];
                case 'preparing': return COLORS.primary[500];
                case 'ready': return COLORS.success[500];
                case 'delivered': return COLORS.success[600];
                case 'cancelled': return COLORS.error[500];
                default: return COLORS.neutral[500];
            }
        };

        const getStatusIcon = (status: string) => {
            switch (status) {
                case 'pending': return <Clock size={16} color={getStatusColor(status)} />;
                case 'preparing': return <ChefHat size={16} color={getStatusColor(status)} />;
                case 'ready': return <CheckCircle2 size={16} color={getStatusColor(status)} />;
                case 'delivered': return <CheckCircle2 size={16} color={getStatusColor(status)} />;
                case 'cancelled': return <XCircle size={16} color={getStatusColor(status)} />;
                default: return <Clock size={16} color={getStatusColor(status)} />;
            }
        };

        return (
            <GlassCard style={styles.orderCard}>
                <View style={styles.orderHeader}>
                    <Text style={styles.orderId}>Order #{item.id.slice(-8)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                        {getStatusIcon(item.status)}
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Text>
                    </View>
                </View>

                <Text style={styles.orderTotal}>Total: ₹{item.total_amount}</Text>
                <Text style={styles.orderDate}>
                    {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>

                {item.estimated_ready_time && (
                    <Text style={styles.estimatedTime}>
                        Estimated ready: {new Date(item.estimated_ready_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                )}
            </GlassCard>
        );
    };

    if (isLoading) {
        return (
            <AppScreen>
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary[600]} />
                    <Text style={styles.loaderText}>Loading Palm Cafe...</Text>
                </View>
            </AppScreen>
        );
    }

    if (!isCafeOpen) {
        return (
            <AppScreen title="Palm Cafe" subtitle="Cafe ordering system">
                <View style={styles.closedContainer}>
                    <Ban size={48} color={COLORS.error[400]} />
                    <Text style={styles.closedTitle}>Palm Cafe is currently closed</Text>
                    <Text style={styles.closedText}>
                        The cafe is currently not accepting orders. Please check back during operating hours.
                    </Text>
                </View>
            </AppScreen>
        );
    }

    return (
        <AppScreen title="Palm Cafe" subtitle="Fresh food & beverages">
            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'menu' ? styles.tabActive : null]}
                    onPress={() => setActiveTab('menu')}
                >
                    <UtensilsCrossed size={20} color={activeTab === 'menu' ? COLORS.primary[600] : COLORS.neutral[500]} />
                    <Text style={[styles.tabText, activeTab === 'menu' ? styles.tabTextActive : null]}>Menu</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'cart' ? styles.tabActive : null]}
                    onPress={() => setActiveTab('cart')}
                >
                    <ShoppingCart size={20} color={activeTab === 'cart' ? COLORS.primary[600] : COLORS.neutral[500]} />
                    {cart.length > 0 && (
                        <View style={styles.cartBadge}>
                            <Text style={styles.cartBadgeText}>{cart.length}</Text>
                        </View>
                    )}
                    <Text style={[styles.tabText, activeTab === 'cart' ? styles.tabTextActive : null]}>Cart</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'orders' ? styles.tabActive : null]}
                    onPress={() => setActiveTab('orders')}
                >
                    <History size={20} color={activeTab === 'orders' ? COLORS.primary[600] : COLORS.neutral[500]} />
                    <Text style={[styles.tabText, activeTab === 'orders' ? styles.tabTextActive : null]}>Orders</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'menu' && (
                <>
                    {/* Categories */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoriesContainer}
                        contentContainerStyle={styles.categoriesContent}
                    >
                        {Object.keys(CATEGORY_CONFIG).map(renderCategoryButton)}
                    </ScrollView>

                    {/* Menu Items */}
                    <FlatList
                        data={filteredMenuItems}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMenuItem}
                        style={styles.menuList}
                        contentContainerStyle={styles.menuContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <UtensilsCrossed size={48} color={COLORS.neutral[300]} />
                                <Text style={styles.emptyTitle}>No items available</Text>
                                <Text style={styles.emptyText}>Check back later for menu updates</Text>
                            </View>
                        }
                    />
                </>
            )}

            {activeTab === 'cart' && (
                <View style={styles.cartContainer}>
                    {cart.length > 0 ? (
                        <>
                            <FlatList
                                data={cart}
                                keyExtractor={(item) => item.id}
                                renderItem={renderCartItem}
                                style={styles.cartList}
                                showsVerticalScrollIndicator={false}
                            />

                            <View style={styles.cartSummary}>
                                <View style={styles.totalRow}>
                                    <Text style={styles.totalLabel}>Total Amount:</Text>
                                    <Text style={styles.totalAmount}>₹{cartTotal}</Text>
                                </View>

                                <TouchableOpacity
                                    style={[styles.placeOrderButton, isPlacingOrder ? styles.placeOrderButtonDisabled : null]}
                                    onPress={placeOrder}
                                    disabled={isPlacingOrder}
                                >
                                    {isPlacingOrder ? (
                                        <ActivityIndicator size="small" color={COLORS.neutral[50]} />
                                    ) : (
                                        <>
                                            <CreditCard size={20} color={COLORS.neutral[50]} />
                                            <Text style={styles.placeOrderText}>Place Order (₹{cartTotal})</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <View style={styles.emptyCart}>
                            <ShoppingCart size={48} color={COLORS.neutral[300]} />
                            <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
                            <Text style={styles.emptyCartText}>Add some delicious items from the menu</Text>
                        </View>
                    )}
                </View>
            )}

            {activeTab === 'orders' && (
                <FlatList
                    data={orders}
                    keyExtractor={(item) => item.id}
                    renderItem={renderOrder}
                    style={styles.ordersList}
                    contentContainerStyle={styles.ordersContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyOrders}>
                            <History size={48} color={COLORS.neutral[300]} />
                            <Text style={styles.emptyOrdersTitle}>No orders yet</Text>
                            <Text style={styles.emptyOrdersText}>Your order history will appear here</Text>
                        </View>
                    }
                />
            )}
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    loaderContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loaderText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[600],
        marginTop: SPACING.md,
    },
    closedContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    closedTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.error[600],
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    closedText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[600],
        textAlign: 'center',
        lineHeight: 24,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.neutral[50],
        borderRadius: BORDER_RADIUS.lg,
        margin: SPACING.md,
        padding: SPACING.xs,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        position: 'relative',
    },
    tabActive: {
        backgroundColor: COLORS.neutral[50],
        ...SHADOWS.sm,
    },
    tabText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[500],
        marginLeft: SPACING.xs,
    },
    tabTextActive: {
        color: COLORS.primary[600],
    },
    cartBadge: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: COLORS.primary[600],
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartBadgeText: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[50],
        fontSize: 12,
    },
    categoriesContainer: {
        maxHeight: 120,
        marginHorizontal: SPACING.md,
    },
    categoriesContent: {
        paddingHorizontal: SPACING.sm,
        gap: SPACING.sm,
    },
    categoryButton: {
        width: 100,
        height: 100,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        ...SHADOWS.sm,
    },
    categoryButtonSelected: {
        ...SHADOWS.md,
        transform: [{ scale: 1.05 }],
    },
    categoryGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.sm,
    },
    categoryLabel: {
        ...TYPOGRAPHY.captionBold,
        color: COLORS.neutral[50],
        marginTop: SPACING.xs,
        textAlign: 'center',
    },
    categoryTime: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[200],
        fontSize: 10,
        marginTop: 2,
        textAlign: 'center',
    },
    menuList: {
        flex: 1,
    },
    menuContent: {
        padding: SPACING.md,
        gap: SPACING.sm,
    },
    menuItemCard: {
        padding: SPACING.md,
    },
    menuItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuItemInfo: {
        flex: 1,
    },
    menuItemName: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[800],
        marginBottom: SPACING.xs,
    },
    menuItemDescription: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[600],
        marginBottom: SPACING.sm,
        lineHeight: 18,
    },
    menuItemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    menuItemPrice: {
        ...TYPOGRAPHY.h4,
        color: COLORS.primary[600],
        fontWeight: 'bold',
    },
    preparationTime: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    preparationTimeText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        marginLeft: SPACING.xs,
    },
    addToCartButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary[600],
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.neutral[100],
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.xs,
    },
    quantityButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.neutral[50],
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[800],
        marginHorizontal: SPACING.sm,
        minWidth: 24,
        textAlign: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    emptyTitle: {
        ...TYPOGRAPHY.h3,
        color: COLORS.neutral[600],
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
    },
    emptyText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[500],
        textAlign: 'center',
    },
    cartContainer: {
        flex: 1,
    },
    cartList: {
        flex: 1,
    },
    cartItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.neutral[50],
        margin: SPACING.md,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
    },
    cartItemInfo: {
        flex: 1,
    },
    cartItemName: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.neutral[800],
        marginBottom: SPACING.xs,
    },
    cartItemPrice: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[600],
    },
    removeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.error[50],
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartSummary: {
        backgroundColor: COLORS.neutral[50],
        padding: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.neutral[200],
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    totalLabel: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[800],
    },
    totalAmount: {
        ...TYPOGRAPHY.h3,
        color: COLORS.primary[600],
        fontWeight: 'bold',
    },
    placeOrderButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary[600],
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    placeOrderButtonDisabled: {
        opacity: 0.6,
    },
    placeOrderText: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[50],
        fontWeight: 'bold',
    },
    emptyCart: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    emptyCartTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.neutral[600],
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
    },
    emptyCartText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[500],
        textAlign: 'center',
    },
    ordersList: {
        flex: 1,
    },
    ordersContent: {
        padding: SPACING.md,
        gap: SPACING.sm,
    },
    orderCard: {
        padding: SPACING.md,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    orderId: {
        ...TYPOGRAPHY.h4,
        color: COLORS.neutral[800],
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.xs,
    },
    statusText: {
        ...TYPOGRAPHY.captionBold,
        fontSize: 12,
    },
    orderTotal: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.primary[600],
        marginBottom: SPACING.xs,
    },
    orderDate: {
        ...TYPOGRAPHY.caption,
        color: COLORS.neutral[500],
        marginBottom: SPACING.xs,
    },
    estimatedTime: {
        ...TYPOGRAPHY.caption,
        color: COLORS.success[600],
        fontWeight: 'bold',
    },
    emptyOrders: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    emptyOrdersTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.neutral[600],
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
    },
    emptyOrdersText: {
        ...TYPOGRAPHY.body,
        color: COLORS.neutral[500],
        textAlign: 'center',
    },
});