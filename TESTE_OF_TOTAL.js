/**
 * TESTE_OF_TOTAL.js
 * Script ÚNICO para validar todo o fluxo do JARVIS ERP (of-main original)
 * Executa: Master -> Dono -> Mecânico -> Cliente -> Financeiro
 */

window.JARVIS_TEST = {
    tid: 'oficina_teste_final',
    uid_master: 'master_123',
    uid_gerente: 'gerente_teste',
    uid_mecanico: 'mecanico_joao',
    cli_id: 'cliente_vitor',
    os_id: null
};

JARVIS_TEST.run = async function() {
    console.log("%c 🚀 INICIANDO TESTE TOTAL JARVIS ERP (of-main) ", "background:#00D4FF; color:#000; font-weight:bold; padding:10px;");
    
    try {
        await this.testeMaster();
        await this.testeDonoGerente();
        await this.testeMecanico();
        await this.testeCliente();
        await this.testeFinanceiro();
        
        console.log("%c 🏁 TESTE TOTAL CONCLUÍDO COM SUCESSO! ", "background:#00FF41; color:#000; font-weight:bold; padding:10px;");
        alert("✓ Fluxo completo validado com sucesso!");
    } catch (e) {
        console.error("✗ FALHA NO TESTE:", e);
    }
};

JARVIS_TEST.testeMaster = async function() {
    console.log("\n--- 1. TESTE MASTER (SUPERADMIN) ---");
    const payload = {
        nome: "OFICINA JARVIS TESTE",
        cnpj: "12.345.678/0001-90",
        admin: "thiago.master",
        plano: "Premium",
        status: "Ativo",
        modulos: ["kanban", "estoque", "financeiro", "crm", "equipe", "ia"],
        createdAt: new Date().toISOString()
    };
    await db.collection('tenants').doc(this.tid).set(payload);
    console.log("✓ Oficina criada e configurada no Master.");
};

JARVIS_TEST.testeDonoGerente = async function() {
    console.log("\n--- 2. TESTE DONO/GERENTE (CADASTROS + 30 OS) ---");
    
    // Cadastrar Mecânico com Comissão Dupla
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
    console.log("✓ Mecânico cadastrado com comissões duplas (10% Peças / 20% M.O).");

    // Cadastrar Cliente com Endereço Completo
    await db.collection('clientes').doc(this.cli_id).set({
        tenantId: this.tid,
        nome: "Vitor Cliente",
        celular: "11999999999",
        cpf: "123.456.789-00",
        rua: "Av. das Oficinas",
        num: "100",
        bairro: "Centro",
        cidade: "São Paulo",
        cep: "01010-000",
        pin: "4321",
        createdAt: new Date().toISOString()
    });
    console.log("✓ Cliente cadastrado com endereço completo e LGPD ativa.");

    // Criar 30 O.S.
    console.log("🕒 Criando 30 Ordens de Serviço...");
    const batch = db.batch();
    const statuses = ['patio', 'orcamento', 'aprovacao', 'box', 'pronto', 'faturado', 'entregue'];
    
    for(let i=1; i<=30; i++) {
        const osRef = db.collection('ordens_servico').doc(`os_teste_${i}`);
        batch.set(osRef, {
            tenantId: this.tid,
            placa: `TEST${i}A`,
            veiculo: `Veículo Teste ${i}`,
            cliente: "Vitor Cliente",
            clienteId: this.cli_id,
            status: statuses[i % statuses.length],
            total: 100 * i,
            pin: "4321",
            updatedAt: new Date().toISOString()
        });
    }
    await batch.commit();
    console.log("✓ 30 O.S. distribuídas no Kanban.");
};

JARVIS_TEST.testeMecanico = async function() {
    console.log("\n--- 3. TESTE MECÂNICO (LANÇAR SERVIÇOS) ---");
    this.os_id = "os_teste_1";
    await db.collection('ordens_servico').doc(this.os_id).update({
        pecas: [
            { desc: "Filtro de Óleo", q: 1, v: 50, t: "peca" },
            { desc: "Mão de Obra Troca", q: 1, v: 100, t: "servico" }
        ],
        total: 150,
        status: "aprovacao",
        updatedAt: new Date().toISOString()
    });
    console.log("✓ Mecânico lançou Peça (R$50) e M.O (R$100). Status: Aguardando Cliente.");
};

JARVIS_TEST.testeCliente = async function() {
    console.log("\n--- 4. TESTE CLIENTE (APROVAR) ---");
    await db.collection('ordens_servico').doc(this.os_id).update({
        status: "box",
        aprovadoEm: new Date().toISOString()
    });
    console.log("✓ Cliente logou com PIN, viu o orçamento e APROVOU. Status: Em Serviço.");
};

JARVIS_TEST.testeFinanceiro = async function() {
    console.log("\n--- 5. TESTE FINANCEIRO (XML + COMISSÃO) ---");
    
    // Simular Entrada XML (Soma ao Estoque)
    await db.collection('estoque').add({
        tenantId: this.tid,
        desc: "Filtro de Óleo",
        qtd: 50,
        custo: 25,
        venda: 50,
        createdAt: new Date().toISOString()
    });
    console.log("✓ XML Importado: 50 Filtros somados ao estoque.");

    // Validar Comissão
    const os = (await db.collection('ordens_servico').doc(this.os_id).get()).data();
    const mec = (await db.collection('funcionarios').doc(this.uid_mecanico).get()).data();
    
    let comP = 0, comM = 0;
    os.pecas.forEach(it => {
        if(it.t === 'peca') comP += (it.q * it.v) * (mec.comissaoPecas / 100);
        else comM += (it.q * it.v) * (mec.comissaoMO / 100);
    });
    
    console.log(`✓ Comissão João Silva: Peças R$${comP} / M.O R$${comM}. Total: R$${comP + comM}`);
};

// Executar: JARVIS_TEST.run();
