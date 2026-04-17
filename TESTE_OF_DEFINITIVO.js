/**
 * TESTE_OF_DEFINITIVO.js
 * Script para validar todo o fluxo do JARVIS ERP (of-main original)
 * Executa: Master -> Dono -> Mecânico -> Cliente -> Financeiro (XML)
 */

window.JARVIS_TEST = {
    tid: 'oficina_teste_final',
    uid_mecanico: 'mecanico_joao',
    cli_id: 'cliente_vitor',
    os_id: 'os_teste_1'
};

JARVIS_TEST.run = async function() {
    console.log("%c 🚀 INICIANDO TESTE DEFINITIVO JARVIS ERP ", "background:#00D4FF; color:#000; font-weight:bold; padding:10px;");
    
    try {
        await this.testeMaster();
        await this.testeDonoGerente();
        await this.testeMecanico();
        await this.testeCliente();
        await this.testeFinanceiro();
        
        console.log("%c 🏁 TESTE CONCLUÍDO COM SUCESSO! ", "background:#00FF41; color:#000; font-weight:bold; padding:10px;");
        alert("✓ Fluxo completo validado!\n\nVerifique:\n1. 30 veículos no Kanban.\n2. Comissões duplas no RH.\n3. Endereço no cadastro de clientes.\n4. Botão de XML no estoque.\n5. Botão de PTT no Chat.");
    } catch (e) {
        console.error("✗ FALHA NO TESTE:", e);
    }
};

JARVIS_TEST.testeMaster = async function() {
    console.log("--- 1. TESTE MASTER ---");
    await db.collection('tenants').doc(this.tid).set({
        nome: "OFICINA JARVIS TESTE",
        status: "Ativo",
        createdAt: new Date().toISOString()
    });
    console.log("✓ Oficina criada.");
};

JARVIS_TEST.testeDonoGerente = async function() {
    console.log("--- 2. TESTE DONO (CADASTROS + 30 OS) ---");
    
    // Mecânico com Comissão Dupla
    await db.collection('funcionarios').doc(this.uid_mecanico).set({
        tenantId: this.tid,
        nome: "João Silva",
        cargo: "mecanico",
        comissaoPecas: 10,
        comissaoMO: 20,
        usuario: "joao.silva",
        senha: "123",
        createdAt: new Date().toISOString()
    });

    // Cliente com Endereço Completo
    await db.collection('clientes').doc(this.cli_id).set({
        tenantId: this.tid,
        nome: "Vitor Cliente",
        wpp: "11999999999",
        doc: "123.456.789-00",
        rua: "Av. das Oficinas",
        num: "100",
        bairro: "Centro",
        cidade: "São Paulo",
        cep: "01010-000",
        login: "vitor.cliente",
        pin: "4321",
        createdAt: new Date().toISOString()
    });

    // 30 O.S.
    const batch = db.batch();
    const statuses = ['Triagem', 'Orcamento', 'Orcamento_Enviado', 'Aprovado', 'Andamento', 'Pronto', 'Entregue'];
    for(let i=1; i<=30; i++) {
        batch.set(db.collection('ordens_servico').doc(`os_teste_${i}`), {
            tenantId: this.tid,
            placa: `PLACA${i}`,
            veiculo: `Carro Teste ${i}`,
            clienteId: this.cli_id,
            status: statuses[i % statuses.length],
            total: 150,
            updatedAt: new Date().toISOString()
        });
    }
    await batch.commit();
    console.log("✓ 30 O.S., Mecânico e Cliente cadastrados.");
};

JARVIS_TEST.testeMecanico = async function() {
    console.log("--- 3. TESTE MECÂNICO ---");
    await db.collection('ordens_servico').doc(this.os_id).update({
        pecas: [
            { desc: "Filtro", q: 1, v: 50, t: "peca" },
            { desc: "Mão de Obra", q: 1, v: 100, t: "servico" }
        ],
        status: "Orcamento_Enviado"
    });
    console.log("✓ Serviços lançados na O.S.");
};

JARVIS_TEST.testeCliente = async function() {
    console.log("--- 4. TESTE CLIENTE ---");
    await db.collection('ordens_servico').doc(this.os_id).update({
        status: "Aprovado",
        aprovadoEm: new Date().toISOString()
    });
    console.log("✓ Orçamento aprovado pelo cliente.");
};

JARVIS_TEST.testeFinanceiro = async function() {
    console.log("--- 5. TESTE FINANCEIRO (ESTOQUE) ---");
    await db.collection('estoqueItems').add({
        tenantId: this.tid,
        desc: "Filtro de Óleo",
        qtd: 50,
        custo: 25,
        venda: 50,
        createdAt: new Date().toISOString()
    });
    console.log("✓ Item adicionado ao estoque.");
};
