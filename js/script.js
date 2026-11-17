// ==========================================
// CONFIGURAÇÃO DO FIREBASE E ESTADO GLOBAL
// ==========================================
const firebaseConfig = { projectId: "tempotech" };
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

let usuarioLogado = null;
let dbOS = [];
let dbEstoque = [];
let dbFinanceiro = [];
let dbUsuarios = [
    { id: 'admin1', nome: 'Administrador', login: 'admin', senha: '123', cargo: 'Administrador' },
    { id: 'func1', nome: 'Funcionário', login: 'funcionario', senha: '123', cargo: 'Funcionario' }
];

// ==========================================
// INICIALIZAÇÃO E SESSÃO
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const userSalvo = localStorage.getItem('tempo_tech_user');
    if (userSalvo) {
        try {
            usuarioLogado = JSON.parse(userSalvo);
            iniciarAplicacaoSistema();
        } catch (e) {
            localStorage.removeItem('tempo_tech_user');
        }
    }
});

function realizarLogin(e) {
    e.preventDefault();
    const usuarioInput = document.getElementById('loginUsuario').value.trim();
    const senhaInput = document.getElementById('loginSenha').value.trim();

    const encontrado = dbUsuarios.find(u => u.login === usuarioInput && u.senha === senhaInput);
    if (encontrado) {
        usuarioLogado = encontrado;
        localStorage.setItem('tempo_tech_user', JSON.stringify(usuarioLogado));
        document.getElementById('loginErro').classList.add('hidden');
        iniciarAplicacaoSistema();
    } else {
        document.getElementById('loginErro').classList.remove('hidden');
    }
}

function realizarLogout() {
    localStorage.removeItem('tempo_tech_user');
    usuarioLogado = null;
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginForm').reset();
}

function iniciarAplicacaoSistema() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');

    document.getElementById('userDisplayName').innerText = usuarioLogado.nome;
    document.getElementById('userDisplayRole').innerText = usuarioLogado.cargo;

    // Normaliza o cargo para maiúsculas/minúsculas para evitar erros de digitação
    const cargoLower = (usuarioLogado.cargo || '').toLowerCase();
    const ehAdmin = cargoLower.includes('admin');

    const navFin = document.getElementById('nav-financeiro');
    const navUsr = document.getElementById('nav-usuarios');

    if (!ehAdmin) {
        // Se NÃO for administrador, esconde os menus restritos
        if (navFin) navFin.style.display = 'none';
        if (navUsr) navUsr.style.display = 'none';
    } else {
        // Se FOR administrador, garante que os menus apareçam
        if (navFin) navFin.style.display = 'flex';
        if (navUsr) navUsr.style.display = 'flex';
    }

    conectarFirebaseRealtime();
    mudarAba('dashboard');
}

function mudarAba(abaId) {
    const cargoLower = (usuarioLogado.cargo || '').toLowerCase();
    const ehAdmin = cargoLower.includes('admin');

    if ((abaId === 'financeiro' || abaId === 'usuarios') && !ehAdmin) {
        alert('Acesso restrito a Administradores.');
        return;
    }

    ['dashboard', 'os', 'estoque', 'financeiro', 'usuarios'].forEach(id => {
        const tab = document.getElementById(`tab-${id}`);
        const btn = document.getElementById(`nav-${id}`);
        if (tab) tab.classList.add('hidden');
        if (btn) btn.classList.remove('bg-slate-800', 'text-white');
    });

    const ativaTab = document.getElementById(`tab-${abaId}`);
    const ativoBtn = document.getElementById(`nav-${abaId}`);
    if (ativaTab) ativaTab.classList.remove('hidden');
    if (ativoBtn) ativoBtn.classList.add('bg-slate-800', 'text-white');
}

// ==========================================
// SINCRONIZAÇÃO EM TEMPO REAL (FIREBASE)
// ==========================================
function conectarFirebaseRealtime() {
    db.collection('os').onSnapshot(snapshot => {
        dbOS = [];
        snapshot.forEach(doc => dbOS.push({ id: doc.id, ...doc.data() }));
        atualizarTudoNaTela();
    }, () => console.log("Modo offline ou sem dados em OS"));

    db.collection('estoque').onSnapshot(snapshot => {
        dbEstoque = [];
        snapshot.forEach(doc => dbEstoque.push({ id: doc.id, ...doc.data() }));
        atualizarTudoNaTela();
    }, () => console.log("Modo offline ou sem dados em Estoque"));

    db.collection('financeiro').onSnapshot(snapshot => {
        dbFinanceiro = [];
        snapshot.forEach(doc => dbFinanceiro.push({ id: doc.id, ...doc.data() }));
        atualizarTudoNaTela();
    }, () => console.log("Modo offline ou sem dados em Financeiro"));

    db.collection('usuarios').onSnapshot(snapshot => {
        if (!snapshot.empty) {
            dbUsuarios = [];
            snapshot.forEach(doc => dbUsuarios.push({ id: doc.id, ...doc.data() }));
        }
        renderizarUsuarios();
    }, () => console.log("Usando usuários padrão"));
}

function atualizarTudoNaTela() {
    renderizarDashboard();
    renderizarOS();
    renderizarEstoque();
    renderizarFinanceiro();
}

// ==========================================
// NAVEGAÇÃO DE ABAS
// ==========================================
function mudarAba(abaId) {
    if ((abaId === 'financeiro' || abaId === 'usuarios') && usuarioLogado.cargo !== 'Administrador') {
        alert('Acesso restrito a Administradores.');
        return;
    }

    ['dashboard', 'os', 'estoque', 'financeiro', 'usuarios'].forEach(id => {
        const tab = document.getElementById(`tab-${id}`);
        const btn = document.getElementById(`nav-${id}`);
        if (tab) tab.classList.add('hidden');
        if (btn) btn.classList.remove('bg-slate-800', 'text-white');
    });

    const ativaTab = document.getElementById(`tab-${abaId}`);
    const ativoBtn = document.getElementById(`nav-${abaId}`);
    if (ativaTab) ativaTab.classList.remove('hidden');
    if (ativoBtn) ativoBtn.classList.add('bg-slate-800', 'text-white');
}

// ==========================================
// DASHBOARD
// ==========================================
function renderizarDashboard() {
    const abertas = dbOS.filter(o => o.status !== 'Entregue' && o.status !== 'Concluído').length;
    const concluidas = dbOS.filter(o => o.status === 'Concluído' || o.status === 'Entregue').length;
    const totalEstoque = dbEstoque.reduce((acc, item) => acc + Number(item.qtd || 0), 0);

    const custoTotalEstoque = dbEstoque.reduce((acc, item) => {
        return acc + (Number(item.qtd || 0) * Number(item.precoCusto || item.preco || 0));
    }, 0);

    const entradas = dbFinanceiro.filter(f => f.tipo === 'Entrada').reduce((acc, f) => acc + Number(f.valor || 0), 0);
    const saidas = dbFinanceiro.filter(f => f.tipo === 'Saida').reduce((acc, f) => acc + Number(f.valor || 0), 0);

    document.getElementById('stat-os-abertas').innerText = abertas;
    document.getElementById('stat-os-concluidas').innerText = concluidas;
    document.getElementById('stat-estoque-total').innerText = totalEstoque;
    const elCusto = document.getElementById('card-estoque-custo');
    if (elCusto) elCusto.innerText = `R$ ${custoTotalEstoque.toFixed(2)}`;
    document.getElementById('stat-caixa-mes').innerText = `R$ ${(entradas - saidas).toFixed(2)}`;
}

// ==========================================
// ORDENS DE SERVIÇO (OS)
// ==========================================
function abrirModalOS(id = null) {
    document.getElementById('formOS').reset();
    document.getElementById('osId').value = '';
    document.getElementById('modalOSTitulo').innerText = 'Nova Ordem de Serviço';
    
    if (id) {
        const os = dbOS.find(o => o.id === id);
        if (os) {
            document.getElementById('osId').value = os.id;
            document.getElementById('osCliente').value = os.cliente || '';
            document.getElementById('osTelefone').value = os.telefone || '';
            document.getElementById('osAparelho').value = os.aparelho || '';
            document.getElementById('osValor').value = os.valor || '';
            document.getElementById('osDefeito').value = os.defeito || '';
            document.getElementById('osStatus').value = os.status || 'Aberta';
            document.getElementById('modalOSTitulo').innerText = 'Editar Ordem de Serviço';
        }
    }
    document.getElementById('modalOS').classList.remove('hidden');
}

async function salvarOS(e) {
    e.preventDefault();
    const id = document.getElementById('osId').value;
    const dados = {
        cliente: document.getElementById('osCliente').value,
        telefone: document.getElementById('osTelefone').value,
        aparelho: document.getElementById('osAparelho').value,
        valor: parseFloat(document.getElementById('osValor').value) || 0,
        defeito: document.getElementById('osDefeito').value,
        status: document.getElementById('osStatus').value
    };

    try {
        if (id) {
            await db.collection('os').doc(id).update(dados);
        } else {
            await db.collection('os').add(dados);
        }
        fecharModal('modalOS');
    } catch (err) {
        alert("Erro ao salvar OS.");
    }
}

function renderizarOS() {
    const filtro = document.getElementById('filtroOS').value.toLowerCase();
    const statusFiltro = document.getElementById('statusFiltroOS').value;
    const tbody = document.getElementById('tabelaOS');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtrados = dbOS.filter(os => {
        const matchTexto = (os.cliente && os.cliente.toLowerCase().includes(filtro)) || 
                           (os.aparelho && os.aparelho.toLowerCase().includes(filtro));
        const matchStatus = statusFiltro ? os.status === statusFiltro : true;
        return matchTexto && matchStatus;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500">Nenhuma OS encontrada.</td></tr>`;
        return;
    }

    filtrados.forEach(os => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-950/30 transition">
                <td class="p-4 font-mono text-xs text-slate-400">#${os.id.substring(0, 6)}</td>
                <td class="p-4 font-medium text-white">${os.cliente}</td>
                <td class="p-4 text-slate-300">${os.aparelho}</td>
                <td class="p-4 text-slate-400 truncate max-w-xs">${os.defeito}</td>
                <td class="p-4"><span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-white">${os.status}</span></td>
                <td class="p-4 font-medium text-emerald-400">R$ ${(Number(os.valor) || 0).toFixed(2)}</td>
                <td class="p-4 text-right space-x-2">
                    <button onclick="abrirModalOS('${os.id}')" class="text-slate-400 hover:text-white"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="excluirItem('os', '${os.id}')" class="text-rose-400 hover:text-rose-300"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

// ==========================================
// ESTOQUE
// ==========================================
function abrirModalEstoque(id = null) {
    document.getElementById('formEstoque').reset();
    document.getElementById('estoqueId').value = '';
    
    if (id) {
        const item = dbEstoque.find(e => e.id === id);
        if (item) {
            document.getElementById('estoqueId').value = item.id;
            document.getElementById('estNome').value = item.nome || '';
            document.getElementById('estCategoria').value = item.categoria || '';
            document.getElementById('estQtd').value = item.qtd || 0;
            document.getElementById('estPreco').value = item.preco || 0;
        }
    }
    document.getElementById('modalEstoque').classList.remove('hidden');
}

async function salvarEstoque(e) {
    e.preventDefault();
    const id = document.getElementById('estoqueId').value;
    const dados = {
        nome: document.getElementById('estNome').value,
        categoria: document.getElementById('estCategoria').value,
        qtd: parseInt(document.getElementById('estQtd').value) || 0,
        preco: parseFloat(document.getElementById('estPreco').value) || 0
    };

    try {
        if (id) {
            await db.collection('estoque').doc(id).update(dados);
        } else {
            await db.collection('estoque').add(dados);
        }
        fecharModal('modalEstoque');
    } catch (err) {
        alert("Erro ao salvar peça.");
    }
}

function renderizarEstoque() {
    const filtro = document.getElementById('filtroEstoque').value.toLowerCase();
    const tbody = document.getElementById('tabelaEstoque');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtrados = dbEstoque.filter(e => e.nome && e.nome.toLowerCase().includes(filtro));
    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">Nenhuma peça no estoque.</td></tr>`;
        return;
    }

    filtrados.forEach(item => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-950/30 transition">
                <td class="p-4 font-medium text-white">${item.nome}</td>
                <td class="p-4 text-slate-400">${item.categoria}</td>
                <td class="p-4"><span class="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-mono text-xs">${item.qtd} un</span></td>
                <td class="p-4 font-medium text-emerald-400">R$ ${(Number(item.preco) || 0).toFixed(2)}</td>
                <td class="p-4 text-right space-x-2">
                    <button onclick="abrirModalEstoque('${item.id}')" class="text-slate-400 hover:text-white"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="excluirItem('estoque', '${item.id}')" class="text-rose-400 hover:text-rose-300"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

// ==========================================
// FINANCEIRO
// ==========================================
function abrirModalFinanceiro() {
    // TRAVA DE SEGURANÇA: Bloqueia caso o usuário logado não seja Administrador
    if (usuarioLogado && usuarioLogado.cargo !== 'Administrador') {
        alert('Acesso restrito a Administradores.');
        return;
    }

    document.getElementById('formFinanceiro').reset();
    document.getElementById('finData').valueAsDate = new Date();
    document.getElementById('modalFinanceiro').classList.remove('hidden');
}

async function salvarFinanceiro(e) {
    e.preventDefault();
    if (usuarioLogado && usuarioLogado.cargo !== 'Administrador') {
        alert('Acesso restrito a Administradores.');
        return;
    }

    const dados = {
        descricao: document.getElementById('finDescricao').value,
        tipo: document.getElementById('finTipo').value,
        valor: parseFloat(document.getElementById('finValor').value) || 0,
        data: document.getElementById('finData').value
    };

    try {
        await db.collection('financeiro').add(dados);
        fecharModal('modalFinanceiro');
    } catch (err) {
        alert("Erro ao salvar lançamento.");
    }
}

function renderizarFinanceiro() {
    const tbody = document.getElementById('tabelaFinanceiro');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let entradas = 0;
    let saidas = 0;

    if (dbFinanceiro.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">Nenhum lançamento.</td></tr>`;
    }

    dbFinanceiro.forEach(f => {
        if (f.tipo === 'Entrada') {
            entradas += Number(f.valor || 0);
        } else {
            saidas += Number(f.valor || 0);
        }

        tbody.innerHTML += `
            <tr class="hover:bg-slate-950/30 transition">
                <td class="p-4 font-mono text-xs text-slate-400">${f.data}</td>
                <td class="p-4 font-medium text-white">${f.descricao}</td>
                <td class="p-4"><span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-white">${f.tipo}</span></td>
                <td class="p-4 font-medium ${f.tipo === 'Entrada' ? 'text-emerald-400' : 'text-rose-400'}">R$ ${(Number(f.valor) || 0).toFixed(2)}</td>
                <td class="p-4 text-right">
                    <button onclick="excluirItem('financeiro', '${f.id}')" class="text-rose-400 hover:text-rose-300"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    document.getElementById('fin-entradas').innerText = `R$ ${entradas.toFixed(2)}`;
    document.getElementById('fin-saidas').innerText = `R$ ${saidas.toFixed(2)}`;
    document.getElementById('fin-saldo').innerText = `R$ ${(entradas - saidas).toFixed(2)}`;
}

// ==========================================
// USUÁRIOS
// ==========================================
function abrirModalUsuario() {
    if (usuarioLogado && usuarioLogado.cargo !== 'Administrador') {
        alert('Acesso restrito a Administradores.');
        return;
    }
    document.getElementById('formUsuario').reset();
    document.getElementById('modalUsuario').classList.remove('hidden');
}

async function salvarUsuario(e) {
    e.preventDefault();
    if (usuarioLogado && usuarioLogado.cargo !== 'Administrador') {
        alert('Acesso restrito a Administradores.');
        return;
    }

    const dados = {
        nome: document.getElementById('usrNome').value,
        login: document.getElementById('usrLogin').value,
        senha: document.getElementById('usrSenha').value,
        cargo: document.getElementById('usrCargo').value
    };

    try {
        await db.collection('usuarios').add(dados);
        fecharModal('modalUsuario');
    } catch (err) {
        alert("Erro ao salvar usuário.");
    }
}

function renderizarUsuarios() {
    const tbody = document.getElementById('tabelaUsuarios');
    if (!tbody) return;
    tbody.innerHTML = '';

    dbUsuarios.forEach(u => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-950/30 transition">
                <td class="p-4 font-medium text-white">${u.nome}</td>
                <td class="p-4 text-slate-400 font-mono text-xs">${u.login}</td>
                <td class="p-4"><span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-white">${u.cargo}</span></td>
                <td class="p-4 text-right">
                    ${u.login !== 'admin' ? `<button onclick="excluirItem('usuarios', '${u.id}')" class="text-rose-400 hover:text-rose-300"><i class="fa-solid fa-trash"></i></button>` : ''}
                </td>
            </tr>
        `;
    });
}

// ==========================================
// UTILITÁRIOS GERAIS
// ==========================================
async function excluirItem(colecao, id) {
    if (usuarioLogado && usuarioLogado.cargo !== 'Administrador' && (colecao === 'financeiro' || colecao === 'usuarios')) {
        alert('Acesso restrito a Administradores.');
        return;
    }

    if (confirm("Deseja realmente excluir este item?")) {
        try {
            await db.collection(colecao).doc(id).delete();
        } catch (err) {
            alert("Erro ao excluir.");
        }
    }
}

function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
}