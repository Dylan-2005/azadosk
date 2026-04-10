// ==================== CONFIGURACIÓN ====================
// Inicializar Supabase
const supabaseUrl = 'https://pgprfmrormidbbvrnwaa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncHJmbXJvcm1pZGJidnJud2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDIyODEsImV4cCI6MjA5MTQxODI4MX0.r0Igx_uWxf38Bwa7kTAjjd2LY6KCgqRictEMXWcyVvQ';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Claves de localStorage
const LS_PRODUCTOS = 'AZADOSk_productos';
const LS_ACTUALIZACION = 'AZADOSk_productos_actualizados';

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Depurar estado del usuario
    await depurarUsuario();

    // Verificar si hay sesión activa
    const { data: { user } } = await supabase.auth.getUser();
    if (user && await verificarRolAdmin(user.id)) {
        mostrarPanelAdmin();
    } else {
        mostrarLogin();
    }

    // Cargar productos
    cargarProductos();
});

// ==================== AUTENTICACIÓN ====================
async function autenticar(event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const contrasena = document.getElementById('contrasena').value;

    if (!email || !email.includes('@')) {
        mostrarNotificacion('Ingresa un correo electrónico válido', 'error');
        return;
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: contrasena
        });

        if (error) {
            mostrarNotificacion('Error de autenticación: ' + error.message, 'error');
            return;
        }

        // Verificar si es admin
        console.log('Usuario autenticado:', data.user.id);
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

        console.log('Perfil obtenido:', profile);
        console.log('Error del perfil:', profileError);

        if (profileError || !profile || profile.role !== 'admin') {
            console.log('Usuario no es admin o error en perfil');
            mostrarNotificacion('No tienes permisos de administrador', 'error');
            await supabase.auth.signOut();
            return;
        }

        console.log('Usuario es admin, mostrando panel');
        mostrarNotificacion('¡Bienvenido! Sesión iniciada correctamente', 'success');
        setTimeout(() => {
            mostrarPanelAdmin();
        }, 500);
    } catch (error) {
        mostrarNotificacion('Error al iniciar sesión: ' + error.message, 'error');
    }
}

async function verificarRolAdmin(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        console.log('Verificando rol para userId:', userId);
        console.log('Resultado:', data, 'Error:', error);
        return !error && data && data.role === 'admin';
    } catch (error) {
        console.error('Error verificando rol:', error);
        return false;
    }
}

// Función para actualizar rol a admin (para desarrollo)
async function hacerAdmin() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { error } = await supabase
                .from('profiles')
                .update({ role: 'admin' })
                .eq('id', user.id);

            if (error) {
                console.error('Error actualizando rol:', error);
            } else {
                console.log('Rol actualizado a admin');
                location.reload(); // Recargar página
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Función para crear perfil si no existe
async function crearPerfil() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { error } = await supabase
                .from('profiles')
                .insert({ id: user.id, email: user.email, role: 'admin' });

            if (error) {
                console.error('Error creando perfil:', error);
            } else {
                console.log('Perfil creado');
                location.reload();
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Función para depurar estado del usuario
async function depurarUsuario() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const debugDiv = document.getElementById('debugInfo');

        if (user) {
            console.log('Usuario actual:', user);
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            console.log('Perfil del usuario:', profile);

            let debugText = `Usuario: ${user.email}<br>`;
            if (profile) {
                debugText += `Rol: ${profile.role}<br>`;
                if (profile.role !== 'admin') {
                    debugText += `<button onclick="hacerAdmin()" style="margin-top: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">Hacer Admin</button>`;
                }
            } else {
                debugText += `Perfil: No encontrado<br>`;
                debugText += `<button onclick="crearPerfil()" style="margin-top: 10px; padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Crear Perfil</button>`;
            }

            if (debugDiv) debugDiv.innerHTML = debugText;
        } else {
            console.log('No hay usuario autenticado');
            if (debugDiv) debugDiv.innerHTML = 'No hay usuario autenticado';
        }
    } catch (error) {
        console.error('Error en depuración:', error);
        const debugDiv = document.getElementById('debugInfo');
        if (debugDiv) debugDiv.innerHTML = `Error: ${error.message}`;
    }
}

async function cerrarSesion() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        await supabase.auth.signOut();
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

async function mostrarPanelAdmin() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
    document.body.style.background = '';

    // Mostrar email de usuario
    const { data: { user } } = await supabase.auth.getUser();
    document.getElementById('usuarioActual').textContent = `👤 ${user.email}`;

    // Cargar datos iniciales
    cargarTablaProductos();
    actualizarEstadisticas();
}

// ==================== GESTIÓN DE PRODUCTOS ====================
let productos = [];
let productoEditando = null;

async function cargarProductos() {
    try {
        const { data, error } = await supabase
            .from('productos')
            .select('*');

        if (error) {
            console.error('Error cargando productos desde Supabase:', error);
            productos = getProductosPorDefectoAdmin();
        } else if (data && data.length > 0) {
            productos = data;
        } else {
            productos = getProductosPorDefectoAdmin();
        }
    } catch (error) {
        console.error('Error conectando con Supabase:', error);
        productos = getProductosPorDefectoAdmin();
    }
}

function getProductosPorDefectoAdmin() {
    return [
        { id: 1, nombre: 'Picada Personal', categoria: 'picadas', descripcion: 'Costilla de cerdo, chicharrón, chorizo, papa, yuca y salsa de la casa. Trae 150 gr', ingredientes: 'Costilla de cerdo asada al barril, chicharrón crujiente, chorizo santarosano, papas asadas, yuca frita, salsa de la casa', detalles: 'Porción individual perfecta para 1 persona.', emoji: '🍖', precio: 18000, stock: 20 },
        { id: 2, nombre: 'Picada Doble', categoria: 'picadas', descripcion: 'Costilla de cerdo, chicharrón, chorizo, papa, yuca y salsa de la casa. Trae 320 gr', ingredientes: 'Doble porción de costilla de cerdo asada al barril, chicharrón crujiente, chorizo santarosano, papas asadas, yuca frita, salsa de la casa', detalles: 'Ideal para compartir entre 2 personas.', emoji: '🍗', precio: 37000, stock: 15 },
        { id: 3, nombre: 'Picada Familiar', categoria: 'picadas', descripcion: 'Costilla de cerdo, chicharrón, chorizo, papa, yuca y salsa de la casa. Trae 750 gr', ingredientes: 'Gran porción familiar de costilla de cerdo asada al barril, chicharrón crujiente, chorizo santarosano, papas asadas, yuca frita, salsa de la casa', detalles: 'Perfecta para familias o grupos pequeños.', emoji: '🍲', precio: 70000, stock: 10 },
        { id: 5, nombre: 'Chorizo Santarosano', categoria: 'asado', descripcion: 'Chorizo santarosano con papa y salsa de la casa. Delicioso y auténtico', ingredientes: 'Chorizo santarosano 100% carne de cerdo, papa asada, salsa de la casa', detalles: 'Receta tradicional de la región.', emoji: '🌶️', precio: 7000, stock: 30 },
        { id: 6, nombre: 'Costilla 100gr', categoria: 'adicionales', descripcion: 'Costilla de cerdo asada al barril. 100 gramos de pura satisfacción', ingredientes: 'Costilla de cerdo premium asada al barril, sal y condimentos naturales', detalles: 'Corte premium preparado lentamente.', emoji: '🍖', precio: 9000, stock: 25 },
        { id: 7, nombre: 'Chicharrón 100gr', categoria: 'adicionales', descripcion: 'Chicharrón crujiente 100 gramos. Acompañamiento perfecto', ingredientes: 'Piel de cerdo frita hasta lograr la textura crujiente perfecta, sal marina', detalles: 'Preparado artesanalmente.', emoji: '✨', precio: 9000, stock: 25 },
        { id: 8, nombre: 'Chorizo', categoria: 'adicionales', descripcion: 'Chorizo asado 100 gramos. Sabor incomparable', ingredientes: 'Chorizo 100% carne de cerdo, ajo, pimienta, sal', detalles: 'Chorizo artesanal con condimentos tradicionales.', emoji: '🌶️', precio: 6000, stock: 40 },
        { id: 9, nombre: 'Papas', categoria: 'adicionales', descripcion: 'Papas asadas. El acompañamiento ideal', ingredientes: 'Papas frescas, aceite de oliva, sal marina, romero', detalles: 'Preparadas al horno con hierbas aromáticas.', emoji: '🥔', precio: 3000, stock: 50 },
        { id: 10, nombre: 'Yucas', categoria: 'adicionales', descripcion: 'Yucas fritas deliciosas. Perfectas para acompañar', ingredientes: 'Yuca fresca, aceite vegetal para freír, sal marina', detalles: 'Yuca fresca cortada en bastones y frita.', emoji: '🍗', precio: 3000, stock: 50 }
    ];
}

async function guardarProductosLocal() {
    try {
        // Primero, eliminar todos los productos existentes
        await supabase.from('productos').delete().neq('id', 0);

        // Insertar los productos actualizados
        const { error } = await supabase
            .from('productos')
            .insert(productos);

        if (error) {
            console.error('Error guardando productos en Supabase:', error);
            mostrarNotificacion('Error al guardar productos', 'error');
        } else {
            // Notificar actualización
            localStorage.setItem(LS_ACTUALIZACION, Date.now().toString());
            mostrarNotificacion('Productos guardados correctamente', 'success');
        }
    } catch (error) {
        console.error('Error conectando con Supabase:', error);
        mostrarNotificacion('Error de conexión', 'error');
    }
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

async function guardarProducto(event) {
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

    await guardarProductosLocal();
    limpiarFormulario();
    cargarTablaProductos();
    cambiarSeccion('productos');
}

function syncProductos() {
    localStorage.setItem(LS_ACTUALIZACION, Date.now().toString());
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

async function eliminarProducto(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
        productos = productos.filter(p => p.id !== id);
        await guardarProductosLocal();
        cargarTablaProductos();
        mostrarNotificacion('Producto eliminado correctamente', 'success');
        syncProductos();
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
    link.download = `AZADOS-k-productos-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    mostrarNotificacion('Productos exportados correctamente', 'success');
}

async function resetearProductos() {
    if (confirm('¿Deseas restaurar todos los productos a los valores originales? Esta acción no se puede deshacer.')) {
        await cargarProductos();
        localStorage.removeItem(LS_PRODUCTOS);
        await cargarProductos();
        await guardarProductosLocal();
        cargarTablaProductos();
        actualizarEstadisticas();
        mostrarNotificacion('Productos restaurados a valores originales', 'success');
        syncProductos();
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
// La página principal (index.html) escuchará las claves 'AZADOSk_productos' y 'AZADOSk_productos_actualizados' para recargar datos
