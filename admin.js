// ==================== CONFIGURACIÓN ====================
const CREDENCIALES = {
    usuario: 'Maryury',
    contrasena: 'asadosk2026agosto'
};

// Claves de localStorage
const LS_PRODUCTOS = 'asadosk_productos';
const LS_USUARIO = 'asadosk_usuario';
const LS_SESION = 'asadosk_sesion';

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si hay sesión activa
    if (verificarSesion()) {
        mostrarPanelAdmin();
    } else {
        mostrarLogin();
    }

    // Cargar productos del localStorage o usar los por defecto
    cargarProductos();
});

// ==================== AUTENTICACIÓN ====================
function autenticar(event) {
    event.preventDefault();

    const usuario = document.getElementById('usuario').value;
    const contrasena = document.getElementById('contrasena').value;

    if (usuario === CREDENCIALES.usuario && contrasena === CREDENCIALES.contrasena) {
        // Guardar sesión
        localStorage.setItem(LS_SESION, 'activa');
        localStorage.setItem(LS_USUARIO, usuario);

        mostrarNotificacion('¡Bienvenido! Sesión iniciada correctamente', 'success');
        setTimeout(() => {
            mostrarPanelAdmin();
        }, 500);
    } else {
        mostrarNotificacion('Usuario o contraseña incorrectos', 'error');
        document.getElementById('usuario').value = '';
        document.getElementById('contrasena').value = '';
    }
}

function verificarSesion() {
    return localStorage.getItem(LS_SESION) === 'activa';
}

function cerrarSesion() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        localStorage.removeItem(LS_SESION);
        localStorage.removeItem(LS_USUARIO);
        mostrarNotificacion('Sesión cerrada correctamente', 'success');
        setTimeout(() => {
            mostrarLogin();
        }, 500);
    }
}

function mostrarLogin() {
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
    document.body.style.background = 'linear-gradient(135deg, #FF6B35 0%, #004E89 100%)';
}

function mostrarPanelAdmin() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
    document.body.style.background = '';

    // Mostrar nombre de usuario
    const usuario = localStorage.getItem(LS_USUARIO);
    document.getElementById('usuarioActual').textContent = `👤 ${usuario}`;

    // Cargar datos iniciales
    cargarTablaProductos();
    actualizarEstadisticas();
}

// ==================== GESTIÓN DE PRODUCTOS ====================
let productos = [];
let productoEditando = null;

function cargarProductos() {
    const productosGuardados = localStorage.getItem(LS_PRODUCTOS);

    if (productosGuardados) {
        productos = JSON.parse(productosGuardados);
    } else {
        // Productos por defecto
        productos = [
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
                id: 4,
                nombre: 'Asado al Barril',
                categoria: 'asado',
                descripcion: 'Nuestro clásico asado al barril. ¡El sabor que alegra tu fin de semana!',
                ingredientes: 'Costilla de cerdo premium, chorizo santarosano, chicharrón, morcilla, chinchulines, riñones, hígado, salsa chimichurri, pan casero',
                detalles: 'Nuestro plato estrella preparado con la técnica tradicional del asado al barril. Incluye variedad de achuras y carnes premium. Tiempo de preparación: 4-5 horas.',
                emoji: '🔥',
                precio: 85000,
                stock: 5
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
        guardarProductosLocal();
    }
}

function guardarProductosLocal() {
    localStorage.setItem(LS_PRODUCTOS, JSON.stringify(productos));
}

function cargarTablaProductos(filtro = {}) {
    const tbody = document.getElementById('productosTableBody');
    tbody.innerHTML = '';

    let productosFiltrados = productos;

    // Aplicar filtros
    if (filtro.busqueda) {
        productosFiltrados = productosFiltrados.filter(p =>
            p.nombre.toLowerCase().includes(filtro.busqueda.toLowerCase()) ||
            p.descripcion.toLowerCase().includes(filtro.busqueda.toLowerCase())
        );
    }

    if (filtro.categoria) {
        productosFiltrados = productosFiltrados.filter(p => p.categoria === filtro.categoria);
    }

    if (productosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;">No hay productos que coincidan con los filtros</td></tr>';
        return;
    }

    productosFiltrados.forEach(producto => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>#${producto.id}</strong></td>
            <td>${producto.emoji} ${producto.nombre}</td>
            <td><span class="category-tag">${traducirCategoria(producto.categoria)}</span></td>
            <td>${producto.descripcion.substring(0, 50)}...</td>
            <td><strong>$${formatearPrecio(producto.precio)}</strong></td>
            <td><span class="stock-tag ${producto.stock <= 5 ? 'low-stock' : ''}">${producto.stock || 0}</span></td>
            <td>
                <div class="actions">
                    <button class="action-btn edit-btn" onclick="editarProducto(${producto.id})">✏️ Editar</button>
                    <button class="action-btn delete-btn" onclick="eliminarProducto(${producto.id})">🗑️ Eliminar</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filtrarProductos() {
    const busqueda = document.getElementById('searchInput').value;
    const categoria = document.getElementById('categoryFilter').value;

    cargarTablaProductos({ busqueda, categoria });
}

function guardarProducto(event) {
    event.preventDefault();

    const id = document.getElementById('productoId').value;
    const nombre = document.getElementById('nombre').value;
    const categoria = document.getElementById('categoria').value;
    const emoji = document.getElementById('emoji').value;
    const precio = parseInt(document.getElementById('precio').value);
    const stock = parseInt(document.getElementById('stock').value);
    const descripcion = document.getElementById('descripcion').value;
    const ingredientes = document.getElementById('ingredientes').value;
    const detalles = document.getElementById('detalles').value;

    if (!nombre || !categoria || !emoji || !precio || !descripcion || !ingredientes || !detalles || stock === undefined) {
        mostrarNotificacion('Por favor completa todos los campos', 'error');
        return;
    }

    if (id) {
        // Editar producto existente
        const producto = productos.find(p => p.id === parseInt(id));
        if (producto) {
            producto.nombre = nombre;
            producto.categoria = categoria;
            producto.emoji = emoji;
            producto.precio = precio;
            producto.stock = stock;
            producto.descripcion = descripcion;
            producto.ingredientes = ingredientes;
            producto.detalles = detalles;
            mostrarNotificacion('Producto actualizado correctamente', 'success');
        }
    } else {
        // Crear nuevo producto
        const nuevoId = Math.max(...productos.map(p => p.id), 0) + 1;
        productos.push({
            id: nuevoId,
            nombre,
            categoria,
            emoji,
            precio,
            stock,
            descripcion,
            ingredientes,
            detalles
        });
        mostrarNotificacion('Producto creado correctamente', 'success');
    }

    guardarProductosLocal();
    limpiarFormulario();
    cargarTablaProductos();
    cambiarSeccion('productos');

    // Actualizar también la página principal
    localStorage.setItem('productosActualizados', 'true');
}

function editarProducto(id) {
    const producto = productos.find(p => p.id === id);
    if (producto) {
        document.getElementById('productoId').value = producto.id;
        document.getElementById('nombre').value = producto.nombre;
        document.getElementById('categoria').value = producto.categoria;
        document.getElementById('emoji').value = producto.emoji;
        document.getElementById('precio').value = producto.precio;
        document.getElementById('stock').value = producto.stock || 0;
        document.getElementById('descripcion').value = producto.descripcion;
        document.getElementById('ingredientes').value = producto.ingredientes || '';
        document.getElementById('detalles').value = producto.detalles || '';

        document.getElementById('formTitle').textContent = 'Editar Producto';
        document.getElementById('btnCancelar').style.display = 'inline-block';

        cambiarSeccion('agregar');
        window.scrollTo(0, 0);
    }
}

function eliminarProducto(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
        productos = productos.filter(p => p.id !== id);
        guardarProductosLocal();
        cargarTablaProductos();
        mostrarNotificacion('Producto eliminado correctamente', 'success');
        localStorage.setItem('productosActualizados', 'true');
    }
}

function limpiarFormulario() {
    document.getElementById('productForm').reset();
    document.getElementById('productoId').value = '';
    document.getElementById('formTitle').textContent = 'Agregar Nuevo Producto';
    document.getElementById('btnCancelar').style.display = 'none';
}

// ==================== NAVEGACIÓN ====================
function cambiarSeccion(seccion) {
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
    });

    // Desactivar todos los botones
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar sección seleccionada
    document.getElementById(seccion + 'Section').classList.add('active');

    // Activar botón
    event.target.classList.add('active');

    // Cargar datos si es necesario
    if (seccion === 'productos') {
        cargarTablaProductos();
    } else if (seccion === 'estadisticas') {
        actualizarEstadisticas();
    }
}

// ==================== ESTADÍSTICAS ====================
function actualizarEstadisticas() {
    const totalProductos = productos.length;
    const productosActivos = productos.length;
    const precioPromedio = Math.round(productos.reduce((sum, p) => sum + p.precio, 0) / productos.length);
    const productoMasCaro = Math.max(...productos.map(p => p.precio));

    document.getElementById('totalProductos').textContent = totalProductos;
    document.getElementById('productosActivos').textContent = productosActivos;
    document.getElementById('precioPromedio').textContent = `$${formatearPrecio(precioPromedio)}`;
    document.getElementById('productoMasCaro').textContent = `$${formatearPrecio(productoMasCaro)}`;

    // Actualizar estadísticas por categoría
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = '';

    const categorias = ['picadas', 'asado', 'adicionales'];
    categorias.forEach(cat => {
        const count = productos.filter(p => p.categoria === cat).length;
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `
            <span class="category-name">${traducirCategoria(cat)}</span>
            <span class="category-count">${count} productos</span>
        `;
        categoryList.appendChild(item);
    });
}

// ==================== EXPORTAR E IMPORTAR ====================
function exportarProductos() {
    const dataStr = JSON.stringify(productos, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `asados-k-productos-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    mostrarNotificacion('Productos exportados correctamente', 'success');
}

function resetearProductos() {
    if (confirm('¿Deseas restaurar todos los productos a los valores originales? Esta acción no se puede deshacer.')) {
        cargarProductos();
        localStorage.removeItem(LS_PRODUCTOS);
        cargarProductos();
        guardarProductosLocal();
        cargarTablaProductos();
        actualizarEstadisticas();
        mostrarNotificacion('Productos restaurados a valores originales', 'success');
        localStorage.setItem('productosActualizados', 'true');
    }
}

// ==================== UTILIDADES ====================
function traducirCategoria(categoria) {
    const traducciones = {
        'picadas': 'Picadas',
        'asado': 'Asado al Barril',
        'adicionales': 'Adiciones'
    };
    return traducciones[categoria] || categoria;
}

function formatearPrecio(precio) {
    return precio.toLocaleString('es-CO');
}

function mostrarNotificacion(mensaje, tipo = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = mensaje;
    toast.className = `toast show ${tipo}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==================== SINCRONIZACIÓN CON LA PÁGINA PRINCIPAL ====================
// Los productos se sincronizan automáticamente a través del localStorage
// La página principal (index.html) verificará la clave 'productosActualizados' para recargar datos
