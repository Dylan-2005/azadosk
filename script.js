// Base de datos de productos (sincronizado con localStorage)
let productos = [];

// Cargar productos del localStorage o usar los por defecto
function inicializarProductos() {
    const LS_PRODUCTOS = 'AZADOSk_productos';
    const productosGuardados = localStorage.getItem(LS_PRODUCTOS);

    if (productosGuardados) {
        productos = JSON.parse(productosGuardados);
    } else {
        // Productos por defecto
        productos = [
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
}

// Estado del carrito
let carrito = [];
let productoSeleccionado = null;

// Inicializar la página
document.addEventListener('DOMContentLoaded', () => {
    inicializarProductos();
    cargarCarritoLocal();
    cargarProductos('todos');
    actualizarCarritoUI();
    
    // Escuchar cambios en localStorage para actualizaciones en tiempo real
    window.addEventListener('storage', (e) => {
        if (e.key === 'AZADOSk_productos' || e.key === 'AZADOSk_productos_actualizados') {
            // Recargar productos cuando cambien en cualquier tab/dispositivo
            inicializarProductos();
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

// Cargar carrito del localStorage
function cargarCarritoLocal() {
    const carritoGuardado = localStorage.getItem('AZADOSk_carrito');
    if (carritoGuardado) {
        carrito = JSON.parse(carritoGuardado);
    }
}

// Guardar carrito en localStorage
function guardarCarritoLocal() {
    localStorage.setItem('AZADOSk_carrito', JSON.stringify(carrito));
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
        
        const card = document.createElement('div');
        card.className = `product-card ${agotado ? 'agotado' : ''}`;
        card.innerHTML = `
            <div class="product-image">
                ${producto.emoji}
                ${agotado ? '<span class="agotado-badge">AGOTADO</span>' : ''}
            </div>
            <div class="product-info">
                <span class="product-category">${traducirCategoria(producto.categoria)}</span>
                <h3 class="product-name">${producto.nombre}</h3>
                <p class="product-description">${producto.descripcion}</p>
                <div class="product-footer">
                    <span class="product-price">$${formatearPrecio(producto.precio)}</span>
                    <span class="product-stock">Stock: ${stockDisponible}</span>
                    <button class="product-btn" onclick="abrirProducto(${producto.id})" ${agotado ? 'disabled' : ''}>
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
function agregarAlCarrito() {
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
        guardarProductosLocal();

        // Mostrar notificación
        mostrarNotificacion(`${productoSeleccionado.nombre} agregado al carrito`, 'success');
        cerrarModal();
        actualizarCarritoUI();
        guardarCarritoLocal();
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
                <div class="cart-item-price">$${formatearPrecio(item.precio * item.cantidad)}</div>
                <button class="cart-remove" onclick="eliminarDelCarrito(${item.id})">Eliminar</button>
            </div>
        `).join('');
    }

    // Calcular total
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    document.getElementById('totalPrice').textContent = `$${formatearPrecio(total)}`;

    modal.classList.add('show');
}

// Eliminar del carrito
function eliminarDelCarrito(id) {
    const item = carrito.find(item => item.id === id);
    if (item) {
        // Devolver stock
        const producto = productos.find(p => p.id === id);
        if (producto) {
            producto.stock += item.cantidad;
            guardarProductosLocal();
        }
    }
    
    carrito = carrito.filter(item => item.id !== id);
    actualizarCarritoUI();
    guardarCarritoLocal();
    abrirCarrito();
    cargarProductos('todos'); // Recargar para mostrar stock actualizado
}

// Cerrar carrito
function cerrarCarrito() {
    document.getElementById('cartModal').classList.remove('show');
}

// Confirmar pedido por WhatsApp
function confirmarPedidoWhatsApp() {
    if (carrito.length === 0) {
        mostrarNotificacion('Tu carrito está vacío', 'error');
        return;
    }

    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const detalles = carrito.map(item => `${item.nombre} (${item.cantidad}x)`).join(', ');
    const mensaje = `Hola, quiero hacer un pedido:\n\n${detalles}\n\nTotal: $${formatearPrecio(total)}\n\n*Pedido rápido por WhatsApp*`;

    // Número de WhatsApp
    const numeroWhatsApp = '573052124784';
    const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;

    window.open(url, '_blank');

    // Vaciar carrito después de confirmar
    carrito = [];
    guardarCarritoLocal();
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
function confirmarPedidoCliente(event) {
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
    guardarCarritoLocal();
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

// Animaciones CSS dinámicas
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
