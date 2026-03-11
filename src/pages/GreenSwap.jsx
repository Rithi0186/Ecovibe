import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { localDb } from '../lib/localDb'
import Modal from '../components/Modal'
import { ListSkeleton } from '../components/LoadingSkeleton'
import {
    ShoppingBag, Plus, Search, Filter, Image, Loader2, Tag,
    MapPin, X, ArrowRight, Package, Palette, Eye, MessageCircle
} from 'lucide-react'

const CATEGORIES = {
    exchange: ['Books', 'Stationery', 'Electronics', 'Clothing', 'Sports', 'Other'],
    craft: ['Home Decor', 'Accessories', 'Art', 'Bags', 'Stationery', 'Other'],
}
const CONDITIONS = ['Like New', 'Good', 'Fair', 'Well Used']

const card = {
    background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.3)', borderRadius: '16px',
    boxShadow: '0 4px 30px rgba(0,0,0,0.06)'
}
const inputStyle = {
    width: '100%', padding: '12px 16px', border: '2px solid #e8f5e9',
    borderRadius: '12px', fontSize: '14px', fontFamily: 'Inter, sans-serif',
    outline: 'none', background: 'white', boxSizing: 'border-box'
}
const btnGreen = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
    border: 'none', cursor: 'pointer', width: '100%',
    background: 'linear-gradient(135deg, #4caf50, #2e7d32)',
    color: 'white', boxShadow: '0 4px 12px rgba(76,175,80,0.3)'
}

export default function GreenSwap() {
    const { user, profile } = useAuth()
    const toast = useToast()
    const [tab, setTab] = useState('exchange')
    const [listings, setListings] = useState([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [selectedListing, setSelectedListing] = useState(null)
    const [search, setSearch] = useState('')
    const [catFilter, setCatFilter] = useState('')
    const [sortBy, setSortBy] = useState('newest')
    const [myRequests, setMyRequests] = useState([])
    const [allRequests, setAllRequests] = useState([]) // all requests for all listings

    // Buyer request form state
    const [requestModal, setRequestModal] = useState(null) // listing to request
    const [buyerForm, setBuyerForm] = useState({ rollNo: '', name: '', pickupPoint: '' })
    const [requesting, setRequesting] = useState(false)

    const CAMPUS_LOCATIONS = [
        'Main Library', 'Canteen Block', 'Admin Block', 'Main Gate',
        'Hostel Complex', 'Stationery Shop', 'Pickup Zone', 'Cafeteria',
        'Sports Ground', 'Parking Area'
    ]

    const [form, setForm] = useState({
        title: '', description: '', category: '', subcategory: '',
        condition: 'Good', priceType: 'free', priceAmount: '',
        pickupPoint: '', sellerRollNo: profile?.student_id || '', sellerPhone: '', images: []
    })
    const [creating, setCreating] = useState(false)
    const [imageFiles, setImageFiles] = useState([])

    useEffect(() => { loadListings() }, [tab, catFilter, sortBy])

    function loadListings() {
        setLoading(true)
        try {
            let data = localDb.query('marketplace_listings', l => l.type === tab && l.status === 'active')
            if (catFilter) data = data.filter(l => l.category === catFilter)
            if (sortBy === 'newest') data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            else if (sortBy === 'price_low') data.sort((a, b) => (a.price_amount || 0) - (b.price_amount || 0))
            else if (sortBy === 'price_high') data.sort((a, b) => (b.price_amount || 0) - (a.price_amount || 0))
            // Enrich with profiles
            data = data.map(l => ({ ...l, profiles: localDb.getById('profiles', l.user_id) }))
            setListings(data)

            const reqs = localDb.query('swap_requests', r => r.buyer_id === user.id || r.seller_id === user.id)
            setMyRequests(reqs)

            const allReqs = localDb.query('swap_requests', r => r.status === 'pending' || r.status === 'accepted')
            setAllRequests(allReqs)
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    function handleCreate(e) {
        e.preventDefault()
        if (!form.title.trim() || !form.category) { toast.warning('Please fill in title and category'); return }
        setCreating(true)
        try {
            // Convert images to base64
            const processImages = async () => {
                const imageUrls = []
                for (const file of imageFiles) {
                    const dataUrl = await new Promise((resolve) => {
                        const reader = new FileReader()
                        reader.onload = (ev) => resolve(ev.target.result)
                        reader.readAsDataURL(file)
                    })
                    imageUrls.push(dataUrl)
                }
                return imageUrls
            }
            processImages().then(imageUrls => {
                localDb.insert('marketplace_listings', {
                    user_id: user.id, student_id: profile.student_id, type: tab,
                    title: form.title.trim(), description: form.description.trim(),
                    category: form.category, subcategory: form.subcategory,
                    condition: form.condition, price_type: form.priceType,
                    price_amount: parseFloat(form.priceAmount) || 0,
                    pickup_point_id: form.pickupPoint || null,
                    seller_roll_no: form.sellerRollNo.trim(), seller_phone: form.sellerPhone.trim(),
                    images: imageUrls,
                    status: 'active',
                })
                toast.success('Listing created! 🎉')
                setShowCreate(false)
                setForm({ title: '', description: '', category: '', subcategory: '', condition: 'Good', priceType: 'free', priceAmount: '', pickupPoint: '', sellerRollNo: profile?.student_id || '', sellerPhone: '', images: [] })
                setImageFiles([])
                loadListings()
                setCreating(false)
            })
        } catch (err) { toast.error(err.message || 'Failed to create listing'); setCreating(false) }
    }

    function openRequestModal(listing) {
        setBuyerForm({ rollNo: profile?.student_id || '', name: profile?.name || '', pickupPoint: '' })
        setRequestModal(listing)
    }

    function handleRequest(e) {
        e.preventDefault()
        if (!buyerForm.rollNo.trim() || !buyerForm.name.trim() || !buyerForm.pickupPoint) {
            toast.warning('Please fill in all fields'); return
        }
        setRequesting(true)
        try {
            const message = `📋 Buyer Details:\n• Name: ${buyerForm.name.trim()}\n• Roll No: ${buyerForm.rollNo.trim()}\n• Pickup Point: ${buyerForm.pickupPoint}\n\nInterested in: "${requestModal.title}"`
            localDb.insert('swap_requests', {
                listing_id: requestModal.id, buyer_id: user.id, seller_id: requestModal.user_id,
                message, status: 'pending',
            })
            toast.success('Request sent with your details! The seller will be notified. 📬')
            setRequestModal(null)
            loadListings()
        } catch (err) { toast.error(err.message || 'Failed to send request') }
        finally { setRequesting(false) }
    }

    function handleRequestAction(reqId, status) {
        try {
            const req = localDb.getById('swap_requests', reqId)
            localDb.update('swap_requests', reqId, { status })

            if (status === 'accepted' && req) {
                localDb.update('marketplace_listings', req.listing_id, { status: 'sold' })
                // Update all other pending requests for this listing to 'rejected'
                const otherReqs = localDb.query('swap_requests', r => r.listing_id === req.listing_id && r.id !== reqId && r.status === 'pending')
                otherReqs.forEach(oReq => localDb.update('swap_requests', oReq.id, { status: 'rejected' }))
            }

            toast.success(`Request ${status}`)
            loadListings()
        } catch (err) { toast.error(err.message) }
    }

    function isListingRequested(listingId) {
        return allRequests.some(r => r.listing_id === listingId)
    }

    const filtered = listings.filter(l =>
        !search || l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.description?.toLowerCase().includes(search.toLowerCase())
    )
    const pendingRequests = myRequests.filter(r => r.seller_id === user.id && r.status === 'pending')

    const priceTagStyle = (type) => {
        const colors = { free: { bg: '#c8e6c9', color: '#2e7d32' }, swap: { bg: '#bbdefb', color: '#1565c0' } }
        const { bg, color } = colors[type] || { bg: '#fff3e0', color: '#e65100' }
        return { padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: bg, color, whiteSpace: 'nowrap' }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'Poppins, sans-serif' }}>GreenSwap</h1>
                    <p style={{ color: '#9ca3af', marginTop: '4px' }}>Swap, share, and discover sustainable finds</p>
                </div>
                <button onClick={() => setShowCreate(true)} style={{ ...btnGreen, width: 'auto', padding: '10px 20px', fontSize: '14px' }}>
                    <Plus size={16} /> Create Listing
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px' }}>
                {[{ key: 'exchange', icon: Package, label: 'Student Exchange' }, { key: 'craft', icon: Palette, label: 'Waste-to-Craft' }].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 500,
                        border: 'none', cursor: 'pointer',
                        background: tab === t.key ? '#4caf50' : 'white',
                        color: tab === t.key ? 'white' : '#6b7280',
                        boxShadow: tab === t.key ? '0 4px 12px rgba(76,175,80,0.3)' : 'none'
                    }}>
                        <t.icon size={16} /> {t.label}
                    </button>
                ))}
            </div>

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
                <div style={{ background: '#fffde7', border: '1px solid #fff9c4', borderRadius: '16px', padding: '20px' }}>
                    <p style={{ fontSize: '16px', fontWeight: 600, color: '#f57f17', marginBottom: '12px' }}>
                        📬 You have {pendingRequests.length} pending request(s)
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {pendingRequests.map(r => {
                            // Parse buyer details from message
                            const lines = r.message?.split('\n') || []
                            const nameLine = lines.find(l => l.includes('Name:'))
                            const rollLine = lines.find(l => l.includes('Roll No:'))
                            const pickupLine = lines.find(l => l.includes('Pickup Point:'))
                            const itemLine = lines.find(l => l.includes('Interested in:'))
                            const buyerName = nameLine?.split('Name:')[1]?.trim() || 'Unknown'
                            const buyerRoll = rollLine?.split('Roll No:')[1]?.trim() || ''
                            const pickupPoint = pickupLine?.split('Pickup Point:')[1]?.trim() || ''
                            const itemName = itemLine?.split('Interested in:')[1]?.trim()?.replace(/"/g, '') || ''

                            return (
                                <div key={r.id} style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '1px solid #fef3c7' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: '200px' }}>
                                            <p style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', marginBottom: '8px' }}>🛒 {itemName || 'Item Request'}</p>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '13px' }}>
                                                <span style={{ color: '#6b7280' }}>👤 <strong>{buyerName}</strong></span>
                                                <span style={{ color: '#6b7280' }}>🎓 {buyerRoll}</span>
                                                <span style={{ color: '#6b7280', gridColumn: '1 / -1' }}>📍 Pickup: <strong>{pickupPoint}</strong></span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                            <button onClick={() => handleRequestAction(r.id, 'accepted')} style={{
                                                padding: '8px 16px', background: '#4caf50', color: 'white',
                                                borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                                                border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(76,175,80,0.3)'
                                            }}>✓ Accept</button>
                                            <button onClick={() => handleRequestAction(r.id, 'rejected')} style={{
                                                padding: '8px 16px', background: '#fee2e2', color: '#dc2626',
                                                borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                                                border: 'none', cursor: 'pointer'
                                            }}>✕ Reject</button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input type="text" style={{ ...inputStyle, paddingLeft: '36px' }} placeholder="Search listings..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select style={{ ...inputStyle, width: 'auto' }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                    <option value="">All Categories</option>
                    {CATEGORIES[tab].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select style={{ ...inputStyle, width: 'auto' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                    <option value="newest">Newest</option>
                    <option value="price_low">Price: Low → High</option>
                    <option value="price_high">Price: High → Low</option>
                </select>
            </div>

            {/* Listings */}
            {loading ? <ListSkeleton rows={4} /> : filtered.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {filtered.map(listing => {
                        const requested = isListingRequested(listing.id)
                        return (
                            <div key={listing.id} onClick={() => setSelectedListing(listing)} style={{
                                ...card, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.3s',
                                opacity: requested ? 0.7 : 1
                            }}>
                                <div style={{ height: '176px', background: 'linear-gradient(135deg, #e8f5e9, #ecfdf5)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                                    {listing.images?.[0] ? (
                                        <img src={listing.images[0]} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <ShoppingBag size={32} color="#a5d6a7" />
                                    )}
                                    {requested && (
                                        <div style={{
                                            position: 'absolute', top: '10px', right: '10px',
                                            padding: '8px 15px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                                            background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a',
                                            backdropFilter: 'blur(4px)'
                                        }}>⏳ Requested</div>
                                    )}
                                </div>
                                <div style={{ padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                                        <h3 style={{ fontWeight: 600, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</h3>
                                        <span style={priceTagStyle(listing.price_type)}>
                                            {listing.price_type === 'free' ? 'Free' : listing.price_type === 'swap' ? 'Swap' : `₹${listing.price_amount}`}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '12px' }}>{listing.description}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Tag size={12} /> {listing.category}</span>
                                        <span>{listing.profiles?.name || 'Student'}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '64px 0', color: '#9ca3af' }}>
                    <ShoppingBag size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <p>No listings found. Be the first to create one!</p>
                </div>
            )}

            {/* Listing Detail Modal */}
            <Modal isOpen={!!selectedListing} onClose={() => setSelectedListing(null)} title="Listing Details" size="lg">
                {selectedListing && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {selectedListing.images?.[0] && (
                            <img src={selectedListing.images[0]} alt="" style={{ width: '100%', height: '224px', objectFit: 'cover', borderRadius: '12px' }} />
                        )}
                        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{selectedListing.title}</h2>
                        <p style={{ color: '#4b5563' }}>{selectedListing.description}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                            {[
                                { label: 'Category', val: selectedListing.category },
                                { label: 'Condition', val: selectedListing.condition },
                                { label: 'Price', val: selectedListing.price_type === 'free' ? 'Free' : selectedListing.price_type === 'swap' ? 'Swap Only' : `₹${selectedListing.price_amount}` },
                                { label: 'Seller', val: selectedListing.profiles?.name },
                            ].map((item, i) => (
                                <div key={i} style={{ padding: '12px', background: '#f9fafb', borderRadius: '12px' }}>
                                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>{item.label}</span>
                                    <p style={{ fontWeight: 500 }}>{item.val}</p>
                                </div>
                            ))}
                        </div>

                        {/* Contact Details Section */}
                        {(selectedListing.seller_roll_no || selectedListing.seller_phone) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                                {selectedListing.seller_roll_no && (
                                    <div style={{ padding: '12px', background: '#f0f9ff', borderRadius: '12px' }}>
                                        <span style={{ color: '#0284c7', fontSize: '12px' }}>Seller Roll No</span>
                                        <p style={{ fontWeight: 500, color: '#0369a1' }}>{selectedListing.seller_roll_no}</p>
                                    </div>
                                )}
                                {selectedListing.seller_phone && (
                                    <div style={{ padding: '12px', background: '#f0f9ff', borderRadius: '12px' }}>
                                        <span style={{ color: '#0284c7', fontSize: '12px' }}>Seller Phone</span>
                                        <p style={{ fontWeight: 500, color: '#0369a1' }}>{selectedListing.seller_phone}</p>
                                    </div>
                                )}
                            </div>
                        )}
                        <div style={{ padding: '12px', background: '#e8f5e9', borderRadius: '12px', fontSize: '14px' }}>
                            <p style={{ color: '#2e7d32', fontWeight: 500 }}>💰 Payment: Cash on Delivery</p>
                            <p style={{ color: '#43a047', fontSize: '12px', marginTop: '4px' }}>Meet at campus pickup point</p>
                        </div>
                        {selectedListing.user_id !== user.id && (
                            isListingRequested(selectedListing.id) ? (
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                                    background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a'
                                }}>
                                    ⏳ This item has already been requested
                                </div>
                            ) : (
                                <button onClick={() => { openRequestModal(selectedListing); setSelectedListing(null); }} style={btnGreen}>
                                    <MessageCircle size={16} />
                                    {(selectedListing.price_type === 'custom' || selectedListing.price_type === 'minimal') ? 'Buy This Item' : 'Request This Item'}
                                </button>
                            )
                        )}
                    </div>
                )}
            </Modal>

            {/* Create Listing Modal */}
            {/* Buyer Request Modal */}
            <Modal isOpen={!!requestModal} onClose={() => setRequestModal(null)} title={(requestModal?.price_type === 'custom' || requestModal?.price_type === 'minimal') ? "Buy Item" : "Request Item"} size="sm">
                {requestModal && (
                    <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Item info */}
                        <div style={{
                            padding: '16px', background: '#f0fdf4', borderRadius: '12px',
                            border: '1px solid #bbf7d0'
                        }}>
                            <h3 style={{ fontWeight: 600, fontSize: '16px', color: '#166534' }}>{requestModal.title}</h3>
                            <p style={{ fontSize: '13px', color: '#15803d', marginTop: '4px' }}>
                                {requestModal.price_type === 'free' ? 'Free' : requestModal.price_type === 'swap' ? 'Swap Only' : `₹${requestModal.price_amount}`}
                            </p>
                        </div>

                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Your Details</p>

                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Full Name *</label>
                            <input style={inputStyle} placeholder="Enter your name" value={buyerForm.name}
                                onChange={e => setBuyerForm(p => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Roll Number *</label>
                            <input style={inputStyle} placeholder="Enter your roll number" value={buyerForm.rollNo}
                                onChange={e => setBuyerForm(p => ({ ...p, rollNo: e.target.value }))} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Pickup Point *</label>
                            <select style={inputStyle} value={buyerForm.pickupPoint}
                                onChange={e => setBuyerForm(p => ({ ...p, pickupPoint: e.target.value }))}>
                                <option value="">Select campus location...</option>
                                {CAMPUS_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                        </div>

                        <div style={{
                            padding: '12px', background: '#fffbeb', borderRadius: '10px',
                            border: '1px solid #fde68a', fontSize: '12px', color: '#92400e', lineHeight: 1.5
                        }}>
                            📍 These details will be shared with the seller so they can meet you at the selected pickup point.
                        </div>

                        <button type="submit" disabled={requesting} style={{
                            ...btnGreen,
                            opacity: requesting ? 0.7 : 1,
                            cursor: requesting ? 'not-allowed' : 'pointer'
                        }}>
                            {requesting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowRight size={16} />}
                            {requesting ? 'Sending...' : 'Send Request'}
                        </button>
                    </form>
                )}
            </Modal>

            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Listing" size="lg">
                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Title *</label>
                        <input style={inputStyle} placeholder="What are you listing?" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Description</label>
                        <textarea style={{ ...inputStyle, minHeight: '80px' }} placeholder="Describe your item..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Category *</label>
                            <select style={inputStyle} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                                <option value="">Select...</option>
                                {CATEGORIES[tab].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Condition</label>
                            <select style={inputStyle} value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}>
                                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Your Roll No *</label>
                            <input style={inputStyle} placeholder="E.g., STU001" value={form.sellerRollNo} onChange={e => setForm(p => ({ ...p, sellerRollNo: e.target.value }))} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Your Phone Number</label>
                            <input type="tel" style={inputStyle} placeholder="(Optional) for faster contact" value={form.sellerPhone} onChange={e => setForm(p => ({ ...p, sellerPhone: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Price Type</label>
                            <select style={inputStyle} value={form.priceType} onChange={e => setForm(p => ({ ...p, priceType: e.target.value }))}>
                                <option value="free">Free</option>
                                <option value="swap">Swap</option>
                                <option value="minimal">Minimal Cost</option>
                                <option value="custom">Set Price</option>
                            </select>
                        </div>
                        {(form.priceType === 'minimal' || form.priceType === 'custom') && (
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Price (₹)</label>
                                <input type="number" style={inputStyle} value={form.priceAmount} onChange={e => setForm(p => ({ ...p, priceAmount: e.target.value }))} min="0" />
                            </div>
                        )}
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Images</label>
                        <input type="file" accept="image/*" multiple style={{ ...inputStyle, fontSize: '14px' }} onChange={e => setImageFiles(Array.from(e.target.files).slice(0, 4))} />
                        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Up to 4 images</p>
                    </div>
                    <button type="submit" disabled={creating} style={btnGreen}>
                        {creating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={16} />}
                        {creating ? 'Creating...' : 'Create Listing'}
                    </button>
                </form>
            </Modal>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
