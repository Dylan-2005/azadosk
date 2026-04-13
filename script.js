// Base de datos de productos (sincronizado con localStorage)
let productos = [];

// Inicializar Supabase
const supabaseUrl = 'https://pgprfmrormidbbvrnwaa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncHJmbXJvcm1pZGJidnJud2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDIyODEsImV4cCI6MjA5MTQxODI4MX0.r0Igx_uWxf38Bwa7kTAjjd2LY6KCgqRictEMXWcyVvQ';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Cargar productos del localStorage o usar los por defecto
async function inicializarProductos() {
    try {
        // Intentar cargar desde Supabase
        const { data, error } = await supabaseClient
            .from('productos')
            .select('*');

        if (error) {
            console.error('Error cargando productos desde Supabase:', error);
            throw error;
        }

        if (data && data.length > 0) {
            productos = data;
        } else {
            // Si no hay datos en Supabase, usar productos por defecto
            productos = getProductosPorDefecto();
        }
    } catch (error) {
        console.error('Error conectando con Supabase, usando productos por defecto:', error);
        productos = getProductosPorDefecto();
    }
}

// Función para actualizar stock en Supabase
async function actualizarStockSupabase(id, nuevoStock) {
    try {
        const { error } = await supabaseClient
            .from('productos')
            .update({ stock: nuevoStock })
            .eq('id', id);

        if (error) {
            console.error('Error actualizando stock:', error);
        }
    } catch (error) {
        console.error('Error conectando con Supabase para actualizar stock:', error);
    }
}

// Estado del carrito
let carrito = [];
let productoSeleccionado = null;

// Inicializar la página
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarProductos();
    cargarProductos('todos');
    
    // Cargar carrito en segundo plano (no bloquea UI)
    cargarCarritoBackend().then(() => {
        actualizarCarritoUI();
    });
    
    // Escuchar cambios en localStorage para actualizaciones en tiempo real
    window.addEventListener('storage', async (e) => {
        if (e.key === 'AZADOSk_productos' || e.key === 'AZADOSk_productos_actualizados') {
            // Recargar productos cuando cambien en cualquier tab/dispositivo
            await inicializarProductos();
            cargarProductos('todos');
            // Actualizar carrito si algún producto cambió
            carrito.forEach(item => {
                const productoActualizado = productos.find(p => p.id === item.id);
                if (productoActualizado) {
                    item.nombre = productoActualizado.nombre;
                    item.precio = productoActualizado.precio;
                    item.emoji = productoActualizado.emoji;
                }
            });
            guardarCarritoLocal();
            actualizarCarritoUI();
            if (document.getElementById('cartModal').classList.contains('show')) {
                abrirCarrito();
            }
        }
    });
});

// ==================== CARRITO PERSISTENTE EN SUPABASE ====================

// Generar o recuperar session_id único para el dispositivo
function getSessionId() {
    let sessionId = localStorage.getItem('AZADOSk_session_id');
    if (!sessionId) {
        sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('AZADOSk_session_id', sessionId);
    }
    return sessionId;
}

// Cargar carrito desde Supabase (con fallback a localStorage)
async function cargarCarritoBackend() {
    try {
        const sessionId = getSessionId();
        
        // Intentar cargar desde Supabase
        const { data, error } = await supabaseClient
            .from('carritos')
            .select('*, productos(*)')
            .eq('sesion_id', sessionId);
        
        if (error) {
            console.error('Error cargando carrito de Supabase:', error);
            throw error;
        }
        
        if (data && data.length > 0) {
            // Convertir datos de Supabase al formato del carrito
            carrito = data.map(item => ({
                id: item.producto_id,
                nombre: item.productos?.nombre || 'Producto',
                precio: item.productos?.precio || 0,
                cantidad: item.cantidad,
                emoji: item.productos?.emoji || '🍽️',
                imagen_url: item.productos?.imagen_url || null
            }));
             ('Carrito cargado desde Supabase:', carrito.length, 'items');
        } else {
            // Si no hay datos en Supabase, intentar localStorage (migración)
            const carritoGuardado = localStorage.getItem('AZADOSk_carrito');
            if (carritoGuardado) {
                carrito = JSON.parse(carritoGuardado);
                // Sincronizar con Supabase
                await sincronizarCarritoCompleto();
                 ('Carrito migrado de localStorage a Supabase');
            }
        }
    } catch (error) {
        console.error('Error cargando carrito del backend:', error);
        // Fallback a localStorage
        const carritoGuardado = localStorage.getItem('AZADOSk_carrito');
        if (carritoGuardado) {
            carrito = JSON.parse(carritoGuardado);
        }
    }
}

// Guardar item individual en Supabase
async function guardarCarritoBackend(productoId, cantidad) {
    try {
        const sessionId = getSessionId();
        
        if (cantidad <= 0) {
            // Eliminar item si cantidad es 0
            await supabaseClient
                .from('carritos')
                .delete()
                .eq('sesion_id', sessionId)
                .eq('producto_id', productoId);
        } else {
            // Insertar o actualizar (upsert)
            await supabaseClient
                .from('carritos')
                .upsert({
                    sesion_id: sessionId,
                    producto_id: productoId,
                    cantidad: cantidad,
                    actualizado_en: new Date().toISOString()
                }, {
                    onConflict: 'sesion_id,producto_id'
                });
        }
        
        // Backup en localStorage
        localStorage.setItem('AZADOSk_carrito', JSON.stringify(carrito));
    } catch (error) {
        console.error('Error guardando carrito en backend:', error);
        // Fallback: solo localStorage
        localStorage.setItem('AZADOSk_carrito', JSON.stringify(carrito));
    }
}

// Sincronizar carrito completo con Supabase
async function sincronizarCarritoCompleto() {
    try {
        const sessionId = getSessionId();
        
        // Eliminar carrito actual en Supabase
        await supabaseClient
            .from('carritos')
            .delete()
            .eq('sesion_id', sessionId);
        
        // Insertar items actuales
        if (carrito.length > 0) {
            const items = carrito.map(item => ({
                sesion_id: sessionId,
                producto_id: item.id,
                cantidad: item.cantidad,
                creado_en: new Date().toISOString(),
                actualizado_en: new Date().toISOString()
            }));
            
            await supabaseClient
                .from('carritos')
                .insert(items);
        }
        
        // Backup en localStorage
        localStorage.setItem('AZADOSk_carrito', JSON.stringify(carrito));
    } catch (error) {
        console.error('Error sincronizando carrito:', error);
        // Fallback: solo localStorage
        localStorage.setItem('AZADOSk_carrito', JSON.stringify(carrito));
    }
}

// Funciones legacy para compatibilidad
function cargarCarritoLocal() {
    // Ahora se maneja en cargarCarritoBackend
}

function guardarCarritoLocal() {
    // Ahora se maneja en sincronizarCarritoCompleto
}

// Cargar productos
function cargarProductos(categoria) {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = '';

    const productosFiltrados = categoria === 'todos' 
        ? productos 
        : productos.filter(p => p.categoria === categoria);

    productosFiltrados.forEach(producto => {
        const stockDisponible = producto.stock || 0;
        const agotado = stockDisponible <= 0;
        
        // Mostrar imagen si existe, sino el emoji
        const imagenHtml = producto.imagen_url 
            ? `<img src="${producto.imagen_url}" alt="${producto.nombre}" class="product-img" onclick="event.stopPropagation(); abrirLightbox('${producto.imagen_url}')" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span style="display: none;">${producto.emoji}</span>`
            : producto.emoji;
        
        const card = document.createElement('div');
        card.className = `product-card ${agotado ? 'agotado' : ''}`;
        card.style.cursor = agotado ? 'not-allowed' : 'pointer';
        if (!agotado) {
            card.onclick = () => abrirProducto(producto.id);
        }
        card.innerHTML = `
            <div class="product-image" ${!agotado ? `onclick="event.stopPropagation(); abrirProducto(${producto.id})"` : ''}>
                ${imagenHtml}
                ${agotado ? '<span class="agotado-badge">AGOTADO</span>' : ''}
            </div>
            <div class="product-info">
                <span class="product-category">${traducirCategoria(producto.categoria)}</span>
                <h3 class="product-name">${producto.nombre}</h3>
                <p class="product-description">${producto.descripcion}</p>
                <div class="product-footer">
                    <span class="product-price">$${formatearPrecio(producto.precio)}</span>
                    <span class="product-stock">Stock: ${stockDisponible}</span>
                    <button class="product-btn" onclick="event.stopPropagation(); abrirProducto(${producto.id})" ${agotado ? 'disabled' : ''}>
                        ${agotado ? 'Agotado' : 'Ver'}
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Filtrar productos
function filtrarProductos(categoria) {
    // Actualizar botones activos
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Cargar productos
    cargarProductos(categoria);
}

// Traducir categoría
function traducirCategoria(categoria) {
    const traducciones = {
        'picadas': 'Picadas',
        'asado': 'Asado al Barril',
        'adicionales': 'Adiciones'
    };
    return traducciones[categoria] || categoria;
}

// Formatear precio
function formatearPrecio(precio) {
    return precio.toLocaleString('es-CO');
}

// Abrir modal de producto
function abrirProducto(id) {
    productoSeleccionado = productos.find(p => p.id === id);
    if (productoSeleccionado) {
        const stockDisponible = productoSeleccionado.stock || 0;
        const maxCantidad = Math.min(stockDisponible, 10); // Máximo 10 o el stock disponible
        
        document.getElementById('productTitle').textContent = productoSeleccionado.nombre;
        document.getElementById('productDescription').textContent = productoSeleccionado.descripcion;
        document.getElementById('productPrice').textContent = `$${formatearPrecio(productoSeleccionado.precio)}`;
        document.getElementById('productIngredients').textContent = productoSeleccionado.ingredientes || 'Información no disponible';
        document.getElementById('productDetails').textContent = productoSeleccionado.detalles || 'Información no disponible';
        document.getElementById('quantity').value = 1;
        document.getElementById('quantity').max = maxCantidad;
        
        // Mostrar imagen o emoji en el modal
        const imagenModal = document.getElementById('productImage');
        if (imagenModal) {
            if (productoSeleccionado.imagen_url) {
                imagenModal.innerHTML = `<img src="${productoSeleccionado.imagen_url}" alt="${productoSeleccionado.nombre}" onclick="abrirLightbox('${productoSeleccionado.imagen_url}')" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px; cursor: zoom-in;">`;
            } else {
                imagenModal.innerHTML = `<span style="font-size: 80px;">${productoSeleccionado.emoji}</span>`;
            }
        }
        
        // Mostrar stock disponible
        document.getElementById('productStock').textContent = `Stock disponible: ${stockDisponible}`;
        
        document.getElementById('productModal').classList.add('show');
    }
}

// Cerrar modal de producto
function cerrarModal() {
    document.getElementById('productModal').classList.remove('show');
}

// Incrementar cantidad
function incrementarCantidad() {
    const input = document.getElementById('quantity');
    input.value = parseInt(input.value) + 1;
}

// Decrementar cantidad
function decrementarCantidad() {
    const input = document.getElementById('quantity');
    if (parseInt(input.value) > 1) {
        input.value = parseInt(input.value) - 1;
    }
}

// Agregar al carrito
async function agregarAlCarrito() {
    if (productoSeleccionado) {
        const cantidad = parseInt(document.getElementById('quantity').value);
        const stockDisponible = productoSeleccionado.stock || 0;
        
        // Verificar stock disponible
        if (cantidad > stockDisponible) {
            mostrarNotificacion(`No hay suficiente stock. Solo quedan ${stockDisponible} unidades disponibles.`, 'error');
            return;
        }
        
        // Verificar si el producto ya está en el carrito
        const itemExistente = carrito.find(item => item.id === productoSeleccionado.id);
        
        if (itemExistente) {
            // Verificar que la cantidad total no exceda el stock
            const nuevaCantidad = itemExistente.cantidad + cantidad;
            if (nuevaCantidad > stockDisponible) {
                mostrarNotificacion(`No puedes agregar más unidades. Solo quedan ${stockDisponible - itemExistente.cantidad} unidades disponibles.`, 'error');
                return;
            }
            itemExistente.cantidad = nuevaCantidad;
        } else {
            carrito.push({
                ...productoSeleccionado,
                cantidad: cantidad
            });
        }

        // Reducir stock temporalmente
        productoSeleccionado.stock -= cantidad;
        await actualizarStockSupabase(productoSeleccionado.id, productoSeleccionado.stock);

        // Mostrar notificación
        mostrarNotificacion(`${productoSeleccionado.nombre} agregado al carrito`, 'success');
        cerrarModal();
        actualizarCarritoUI();
        
        // Guardar en backend (sin await - no bloquea UI)
        const itemCarrito = carrito.find(item => item.id === productoSeleccionado.id);
        if (itemCarrito) {
            guardarCarritoBackend(productoSeleccionado.id, itemCarrito.cantidad);
        }
        
        cargarProductos('todos'); // Recargar productos para mostrar stock actualizado
    }
}

// Mostrar notificación
function mostrarNotificacion(mensaje) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background-color: #2C7A3F;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 3000;
        animation: slideIn 0.3s ease-out;
    `;
    notif.textContent = mensaje;
    document.body.appendChild(notif);

    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notif.remove(), 300);
    }, 2500);
}

// Actualizar UI del carrito
function actualizarCarritoUI() {
    const cartCount = document.getElementById('cartCount');
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    cartCount.textContent = totalItems;
}

// Abrir carrito
function abrirCarrito() {
    const modal = document.getElementById('cartModal');
    const cartItems = document.getElementById('cartItems');
    
    if (carrito.length === 0) {
        cartItems.innerHTML = '<div class="empty-cart"><p>Tu carrito está vacío</p></div>';
    } else {
        cartItems.innerHTML = carrito.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.nombre}</div>
                    <div class="cart-item-qty">Cantidad: ${item.cantidad}</div>
                </div>
                <div class="cart-item-actions">
                    <div class="cart-item-price">$${formatearPrecio(item.precio * item.cantidad)}</div>
                    <button class="cart-remove" onclick="eliminarDelCarrito(${item.id})">Eliminar</button>
                </div>
            </div>
        `).join('');
    }

    // Calcular total
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    document.getElementById('totalPrice').textContent = `$${formatearPrecio(total)}`;

    modal.classList.add('show');
}

// Eliminar del carrito
async function eliminarDelCarrito(id) {
    const item = carrito.find(item => item.id === id);
    if (item) {
            // Devolver stock
        const producto = productos.find(p => p.id === id);
        if (producto) {
            producto.stock += item.cantidad;
            await actualizarStockSupabase(producto.id, producto.stock);
        }
    }
    
    carrito = carrito.filter(item => item.id !== id);
    actualizarCarritoUI();
    
    // Eliminar del backend (cantidad 0 = eliminar) - sin await
    guardarCarritoBackend(id, 0);
    
    abrirCarrito();
    cargarProductos('todos'); // Recargar para mostrar stock actualizado
}

// Cerrar carrito
function cerrarCarrito() {
    document.getElementById('cartModal').classList.remove('show');
}

// Confirmar pedido por WhatsApp
async function confirmarPedidoWhatsApp() {
    if (carrito.length === 0) {
        mostrarNotificacion('Tu carrito está vacío', 'error');
        return;
    }

    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const detalles = carrito.map(item => `${item.nombre} (${item.cantidad}x)`).join(', ');
    const mensaje = `Hola, quiero hacer un pedido:\n\n${detalles}\n\nTotal: $${formatearPrecio(total)}\n\n*Pedido rápido por WhatsApp*`;

    // Número de WhatsApp
    const numeroWhatsApp = '573206364371';
    const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;

    window.open(url, '_blank');

    // Vaciar carrito después de confirmar
    carrito = [];
    sincronizarCarritoCompleto(); // Vaciar en backend - sin await
    actualizarCarritoUI();
    cerrarCarrito();
    cargarProductos('todos'); // Recargar para mostrar stock actualizado
    mostrarNotificacion('Pedido enviado por WhatsApp', 'success');
}

// Mostrar formulario de cliente
function mostrarFormularioCliente() {
    cerrarCarrito();
    document.getElementById('clienteModal').classList.add('show');
}

// Cerrar modal de cliente
function cerrarClienteModal() {
    document.getElementById('clienteModal').classList.remove('show');
}

// Confirmar pedido con información del cliente
async function confirmarPedidoCliente(event) {
    event.preventDefault();

    if (carrito.length === 0) {
        mostrarNotificacion('Tu carrito está vacío', 'error');
        return;
    }

    const nombre = document.getElementById('clienteNombre').value;
    const telefono = document.getElementById('clienteTelefono').value;
    const direccion = document.getElementById('clienteDireccion').value;
    const notas = document.getElementById('clienteNotas').value;

    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const detalles = carrito.map(item => `${item.nombre} (${item.cantidad}x)`).join(', ');

    const mensaje = `Hola, quiero hacer un pedido:\n\n*Datos del cliente:*\n👤 ${nombre}\n📱 ${telefono}\n📍 ${direccion}${notas ? `\n📝 Notas: ${notas}` : ''}\n\n*Pedido:*\n${detalles}\n\n💰 Total: $${formatearPrecio(total)}`;

    // Número de WhatsApp
    const numeroWhatsApp = '573206364371';
    const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;

    window.open(url, '_blank');

    // Vaciar carrito después de confirmar
    carrito = [];
    sincronizarCarritoCompleto(); // Vaciar en backend - sin await
    actualizarCarritoUI();
    cerrarClienteModal();
    cargarProductos('todos'); // Recargar para mostrar stock actualizado
    mostrarNotificacion('Pedido confirmado con tu información', 'success');

    // Limpiar formulario
    document.getElementById('clienteForm').reset();
}

// Evento del ícono del carrito
document.addEventListener('DOMContentLoaded', () => {
    const carritoIcon = document.querySelector('.carrito-icon');
    if (carritoIcon) {
        carritoIcon.addEventListener('click', abrirCarrito);
    }
});

// Cerrar modales al hacer clic fuera
window.addEventListener('click', (event) => {
    const productModal = document.getElementById('productModal');
    const cartModal = document.getElementById('cartModal');
    const clienteModal = document.getElementById('clienteModal');

    if (event.target === productModal) {
        cerrarModal();
    }
    if (event.target === cartModal) {
        cerrarCarrito();
    }
    if (event.target === clienteModal) {
        cerrarClienteModal();
    }
});

// ==================== LIGHTBOX ====================

function abrirLightbox(urlImagen) {
    if (!urlImagen) return;
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    lightboxImg.src = urlImagen;
    lightbox.classList.add('show');
    document.body.style.overflow = 'hidden'; // Evitar scroll
}

function cerrarLightbox() {
    const lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('show');
    document.body.style.overflow = ''; // Restaurar scroll
}

// Cerrar lightbox con tecla ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        cerrarLightbox();
        cerrarModal();
        cerrarCarrito();
        cerrarClienteModal();
    }
});

// Función para obtener productos por defecto
function getProductosPorDefecto() {
    return [
        // Picadas
        {
            id: 1,
            nombre: 'Picada Personal',
            categoria: 'picadas',
            descripcion: 'Costilla de cerdo, chicharrón, chorizo, papa, yuca y salsa de la casa. Trae 150 gr',
            ingredientes: 'Costilla de cerdo asada al barril, chicharrón crujiente, chorizo santarosano, papas asadas, yuca frita, salsa de la casa (tomate, cebolla, cilantro y limón)',
            detalles: 'Porción individual perfecta para 1 persona. Preparado con ingredientes frescos y cocinado lentamente al barril para un sabor único.',
            emoji: '🍖',
            precio: 18000,
            stock: 20
        },
        {
            id: 2,
            nombre: 'Picada Doble',
            categoria: 'picadas',
            descripcion: 'Costilla de cerdo, chicharrón, chorizo, papa, yuca y salsa de la casa. Trae 320 gr',
            ingredientes: 'Doble porción de costilla de cerdo asada al barril, chicharrón crujiente, chorizo santarosano, papas asadas, yuca frita, salsa de la casa (tomate, cebolla, cilantro y limón)',
            detalles: 'Ideal para compartir entre 2 personas. Elaborado con cortes premium de cerdo y cocinado tradicionalmente al barril.',
            emoji: '🍗',
            precio: 37000,
            stock: 15
        },
        {
            id: 3,
            nombre: 'Picada Familiar',
            categoria: 'picadas',
            descripcion: 'Costilla de cerdo, chicharrón, chorizo, papa, yuca y salsa de la casa. Trae 750 gr',
            ingredientes: 'Gran porción familiar de costilla de cerdo asada al barril, chicharrón crujiente, chorizo santarosano, papas asadas, yuca frita, salsa de la casa (tomate, cebolla, cilantro y limón)',
            detalles: 'Perfecta para familias o grupos pequeños. Incluye todos nuestros mejores cortes preparados con dedicación y amor.',
            emoji: '🍲',
            precio: 70000,
            stock: 10
        },
        {
            id: 5,
            nombre: 'Chorizo Santarosano',
            categoria: 'asado',
            descripcion: 'Chorizo santarosano con papa y salsa de la casa. Delicioso y auténtico',
            ingredientes: 'Chorizo santarosano 100% carne de cerdo, papa asada, salsa de la casa (tomate, cebolla, cilantro y limón)',
            detalles: 'Chorizo tradicional de la región preparado con recetas ancestrales. Acompañado de papa asada y nuestra salsa especial.',
            emoji: '🌶️',
            precio: 7000,
            stock: 30
        },
        // Adiciones
        {
            id: 6,
            nombre: 'Costilla 100gr',
            categoria: 'adicionales',
            descripcion: 'Costilla de cerdo asada al barril. 100 gramos de pura satisfacción',
            ingredientes: 'Costilla de cerdo premium asada al barril, sal y condimentos naturales',
            detalles: 'Corte premium de costilla cocinado lentamente al barril para lograr la textura perfecta y sabor incomparable.',
            emoji: '🍖',
            precio: 9000,
            stock: 25
        },
        {
            id: 7,
            nombre: 'Chicharrón 100gr',
            categoria: 'adicionales',
            descripcion: 'Chicharrón crujiente 100 gramos. Acompañamiento perfecto',
            ingredientes: 'Piel de cerdo frita hasta lograr la textura crujiente perfecta, sal marina',
            detalles: 'Preparado artesanalmente con técnicas tradicionales. La piel se fríe lentamente para lograr el punto perfecto de crujiente.',
            emoji: '✨',
            precio: 9000,
            stock: 25
        },
        {
            id: 8,
            nombre: 'Chorizo 100gr',
            categoria: 'adicionales',
            descripcion: 'Chorizo asado 100 gramos. Sabor incomparable',
            ingredientes: 'Chorizo 100% carne de cerdo, condimentos naturales, ajo, pimienta, sal',
            detalles: 'Chorizo artesanal preparado con carnes seleccionadas y condimentos tradicionales de la región.',
            emoji: '🌶️',
            precio: 6000,
            stock: 40
        },
        {
            id: 9,
            nombre: 'Papas',
            categoria: 'adicionales',
            descripcion: 'Papas asadas. El acompañamiento ideal',
            ingredientes: 'Papas frescas, aceite de oliva, sal marina, romero',
            detalles: 'Papas asadas al horno con hierbas aromáticas. Preparadas lentamente para mantener todo su sabor natural.',
            emoji: '🥔',
            precio: 3000,
            stock: 50
        },
        {
            id: 10,
            nombre: 'Yucas',
            categoria: 'adicionales',
            descripcion: 'Yucas fritas deliciosas. Perfectas para acompañar',
            ingredientes: 'Yuca fresca, aceite vegetal para freír, sal marina',
            detalles: 'Yuca fresca cortada en bastones y frita hasta lograr la textura perfecta. Acompañamiento tradicional.',
            emoji: '🍗',
            precio: 3000,
            stock: 50
        }
    ];
}

// ==================== SEGURIDAD ADMIN ====================
// Clave hardcodeada como fallback (solo si no hay conexión a Supabase)
const ADMIN_ACCESS_KEY_FALLBACK = 'azadosk2024admin';
const ADMIN_SESSION_KEY = 'AZADOSk_admin_access_verified';
const ADMIN_SESSION_DURATION = 30 * 60 * 1000; // 30 minutos

// Variable para almacenar la clave obtenida de Supabase
let adminAccessKeyFromSupabase = null;

// Función para obtener la clave de acceso desde Supabase (usa instancia global)
async function obtenerClaveAdminDesdeSupabase() {
    try {
        // Usar instancia global supabaseClient (ya inicializada al principio del archivo)
        const { data, error } = await supabaseClient
            .from('configuracion')
            .select('valor')
            .eq('clave', 'admin_access_key')
            .single();
        
        if (error || !data) {
            console.warn('No se pudo obtener clave de Supabase, usando fallback');
            return ADMIN_ACCESS_KEY_FALLBACK;
        }
        
        return data.valor || ADMIN_ACCESS_KEY_FALLBACK;
    } catch (error) {
        console.error('Error obteniendo clave de Supabase:', error);
        return ADMIN_ACCESS_KEY_FALLBACK;
    }
}

async function abrirModalSeguridad(event) {
    if (event) event.preventDefault();
    
    // Verificar si ya tiene sesión válida
    if (verificarSesionAdmin()) {
        window.location.href = 'admin.html';
        return;
    }
    
    // Obtener clave desde Supabase (o usar fallback)
    if (!adminAccessKeyFromSupabase) {
        adminAccessKeyFromSupabase = await obtenerClaveAdminDesdeSupabase();
    }
    
    const modal = document.getElementById('adminSecurityModal');
    modal.classList.add('show');
    document.getElementById('adminClave').value = '';
    document.getElementById('adminClave').focus();
    document.getElementById('adminErrorMsg').textContent = '';
    document.body.style.overflow = 'hidden';
}

function cerrarModalSeguridad() {
    const modal = document.getElementById('adminSecurityModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

async function verificarClaveAdmin(event) {
    event.preventDefault();
    
    const claveInput = document.getElementById('adminClave');
    const clave = claveInput.value.trim();
    const errorMsg = document.getElementById('adminErrorMsg');
    
    // Si no tenemos la clave de Supabase, obtenerla
    if (!adminAccessKeyFromSupabase) {
        adminAccessKeyFromSupabase = await obtenerClaveAdminDesdeSupabase();
    }
    
    if (clave === adminAccessKeyFromSupabase) {
        // Crear sesión válida
        crearSesionAdmin();
        cerrarModalSeguridad();
        window.location.href = 'admin.html';
    } else {
        errorMsg.textContent = '❌ Clave incorrecta. Acceso denegado.';
        claveInput.value = '';
        claveInput.focus();
        
        // Efecto de shake en el input
        claveInput.style.animation = 'shake 0.5s';
        setTimeout(() => {
            claveInput.style.animation = '';
        }, 500);
    }
}

function crearSesionAdmin() {
    const sessionData = {
        verified: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + ADMIN_SESSION_DURATION
    };
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessionData));
}

function verificarSesionAdmin() {
    const sessionStr = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!sessionStr) return false;
    
    try {
        const session = JSON.parse(sessionStr);
        
        // Verificar si expiró
        if (Date.now() > session.expiresAt) {
            sessionStorage.removeItem(ADMIN_SESSION_KEY);
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

function limpiarSesionAdmin() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('adminSecurityModal');
        if (modal && modal.classList.contains('show')) {
            cerrarModalSeguridad();
        }
    }
});

// Verificar sesión al cargar admin.html
if (window.location.pathname.includes('admin.html')) {
    // Solo verificar si viene del cliente, no si viene de login de Supabase
    const urlParams = new URLSearchParams(window.location.search);
    const fromLogin = urlParams.get('from') === 'login';
    
    if (!fromLogin && !verificarSesionAdmin()) {
        // Redirigir al cliente si no tiene sesión válida
        window.location.href = 'index.html?access=denied';
    }
}

// Agregar animación shake CSS dinámicamente
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(shakeStyle);

// ==================== HORARIOS DEL NEGOCIO ====================
let horariosData = null;

// Cargar horarios al iniciar
async function cargarHorariosNegocio() {
    try {
        const { data: horarios, error } = await supabaseClient
            .from('horarios')
            .select('*')
            .order('dia_semana');
        
        if (error) {
            console.warn('Error cargando horarios:', error);
            return;
        }
        
        horariosData = horarios;
        actualizarEstadoNegocio();
        
    } catch (error) {
        console.error('Error cargando horarios:', error);
    }
}

function actualizarEstadoNegocio() {
    if (!horariosData) return;
    
    const ahora = new Date();
    const diaSemana = ahora.getDay();
    const horaActual = ahora.getHours() + ':' + String(ahora.getMinutes()).padStart(2, '0');
    
    const horarioHoy = horariosData.find(h => h.dia_semana === diaSemana);
    const estadoBadge = document.getElementById('estadoNegocio');
    
    if (!estadoBadge) return;
    
    if (!horarioHoy || !horarioHoy.abierto) {
        estadoBadge.textContent = '🔴 Cerrado';
        estadoBadge.className = 'estado-badge estado-cerrado';
        return;
    }
    
    const abierto = horaActual >= horarioHoy.hora_apertura && horaActual <= horarioHoy.hora_cierre;
    
    if (abierto) {
        estadoBadge.textContent = '🟢 Abierto';
        estadoBadge.className = 'estado-badge estado-abierto';
    } else {
        estadoBadge.textContent = '🔴 Cerrado';
        estadoBadge.className = 'estado-badge estado-cerrado';
    }
}

function mostrarHorariosModal(event) {
    if (event) event.stopPropagation();
    
    const modal = document.getElementById('horariosModal');
    const lista = document.getElementById('horariosLista');
    const estadoFooter = document.getElementById('estadoHorario');
    
    if (!horariosData) {
        lista.innerHTML = '<p style="text-align: center; color: #666;">Cargando horarios...</p>';
        cargarHorariosNegocio().then(() => mostrarHorariosModal());
        return;
    }
    
    const diasNombre = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaHoy = new Date().getDay();
    
    lista.innerHTML = diasNombre.map((dia, index) => {
        const horario = horariosData.find(h => h.dia_semana === index);
        const esHoy = index === diaHoy;
        const claseHoy = esHoy ? 'hoy' : '';
        
        let horaTexto;
        if (!horario || !horario.abierto) {
            horaTexto = '<span class="horario-hora-cliente cerrado">Cerrado</span>';
        } else {
            horaTexto = `<span class="horario-hora-cliente">${horario.hora_apertura} - ${horario.hora_cierre}</span>`;
        }
        
        return `
            <div class="horario-item-cliente ${claseHoy}">
                <span class="horario-dia-cliente">${dia} ${esHoy ? '(Hoy)' : ''}</span>
                ${horaTexto}
            </div>
        `;
    }).join('');
    
    // Estado en footer
    const estadoBadge = document.getElementById('estadoNegocio');
    if (estadoFooter && estadoBadge) {
        estadoFooter.innerHTML = estadoBadge.outerHTML;
    }
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function cerrarHorariosModal(event) {
    if (event) {
        // Si clickeó en el contenido (no en el fondo), no cerrar
        if (event.target.closest('.horarios-modal-content') && !event.target.classList.contains('horarios-close')) {
            return;
        }
    }
    
    const modal = document.getElementById('horariosModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

// Actualizar estado cada minuto
setInterval(actualizarEstadoNegocio, 60000);

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('horariosModal');
        if (modal && modal.classList.contains('show')) {
            cerrarHorariosModal();
        }
    }
});

// Cargar horarios al iniciar página
document.addEventListener('DOMContentLoaded', () => {
    cargarHorariosNegocio();
});
