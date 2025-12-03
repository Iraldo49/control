 const STORAGE_KEY = 'dividas_a_receber';
    let dividas = [];
    let editingId = null;
    let lembreteInterval;
    let filtroAtual = 'todos';

    // Inicializar
    document.addEventListener('DOMContentLoaded', function() {
      carregarDividas();
      verificarPrazos();
      iniciarVerificacaoPrazos();
      definirDataAtual();
      
      const form = document.getElementById('form-devedor');
      form.addEventListener('submit', handleSubmit);
    });

    // Funções principais
    function carregarDividas() {
      const dados = localStorage.getItem(STORAGE_KEY);
      dividas = dados ? JSON.parse(dados) : [];
      atualizarInterface();
    }

    function salvarDividas() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dividas));
      atualizarInterface();
      verificarPrazos();
    }

    function atualizarInterface() {
      atualizarResumo();
      atualizarListaDividas();
      atualizarFooter();
    }

    function atualizarResumo() {
      const totalPendente = dividas
        .filter(d => d.status === 'pendente')
        .reduce((sum, d) => sum + d.valor, 0);
      
      const totalRecebido = dividas
        .filter(d => d.status === 'pago')
        .reduce((sum, d) => sum + d.valor, 0);
      
      const devedoresPendentes = dividas.filter(d => d.status === 'pendente').length;
      const devedoresAtrasados = dividas.filter(d => d.atrasada).length;

      document.getElementById('resumo-container').innerHTML = `
        <div class="resumo-item">
          <p class="resumo-label">💰 A Receber</p>
          <p class="resumo-valor">MT ${totalPendente.toFixed(2).replace('.', ',')}</p>
          ${devedoresAtrasados > 0 ? `<span class="resumo-badge badge-danger">${devedoresAtrasados} atrasadas</span>` : ''}
        </div>
        <div class="resumo-item">
          <p class="resumo-label">✅ Recebido</p>
          <p class="resumo-valor">MT ${totalRecebido.toFixed(2).replace('.', ',')}</p>
        </div>
        <div class="resumo-item">
          <p class="resumo-label">👤 Devedores</p>
          <p class="resumo-valor">${devedoresPendentes}</p>
        </div>
      `;
    }

    function atualizarListaDividas() {
      const container = document.getElementById('dividas-container');
      
      // Filtrar dívidas
      let dividasFiltradas = [...dividas];
      
      if (filtroAtual === 'pendente') {
        dividasFiltradas = dividasFiltradas.filter(d => d.status === 'pendente');
      } else if (filtroAtual === 'pago') {
        dividasFiltradas = dividasFiltradas.filter(d => d.status === 'pago');
      } else if (filtroAtual === 'atrasada') {
        dividasFiltradas = dividasFiltradas.filter(d => d.atrasada);
      }
      
      // Ordenar: atrasadas primeiro, depois pendentes, depois pagas
      dividasFiltradas.sort((a, b) => {
        if (a.atrasada && !b.atrasada) return -1;
        if (!a.atrasada && b.atrasada) return 1;
        if (a.status !== b.status) {
          return a.status === 'pendente' ? -1 : 1;
        }
        return new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0);
      });

      if (dividasFiltradas.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">💰</div>
            <h3>${filtroAtual !== 'todos' ? 'Nenhuma dívida encontrada' : 'Nenhuma dívida registrada'}</h3>
            <p>${filtroAtual !== 'todos' ? 'Tente mudar o filtro' : 'Clique no botão "+" para adicionar'}</p>
          </div>
        `;
        return;
      }

      container.innerHTML = dividasFiltradas.map(divida => {
        const atrasadaClass = divida.atrasada ? 'atrasada' : '';
        let statusLabel = divida.status === 'pago' ? 'Recebido' : 'Pendente';
        let statusClass = divida.status === 'pago' ? 'status-pago' : 'status-pendente';
        
        if (divida.atrasada) {
          statusLabel = 'Atrasada';
          statusClass = 'status-atrasada';
        }

        // Calcular dias de atraso se houver prazo
        let diasInfo = '';
        if (divida.data && divida.prazo && divida.status !== 'pago') {
          const dataDivida = new Date(divida.data);
          const dataVencimento = new Date(dataDivida);
          dataVencimento.setDate(dataVencimento.getDate() + parseInt(divida.prazo));
          const agora = new Date();
          const diasAtraso = Math.floor((agora - dataVencimento) / (1000 * 60 * 60 * 24));
          
          if (diasAtraso > 0) {
            diasInfo = `<span style="color: #c53030;">⏰ ${diasAtraso} dia(s) atrasado</span>`;
          } else if (diasAtraso >= -3 && diasAtraso < 0) {
            diasInfo = `<span style="color: #ed8936;">⚠️ Vence em ${Math.abs(diasAtraso)} dia(s)</span>`;
          }
        }

        return `
          <div class="divida-item ${atrasadaClass}" data-id="${divida.id}">
            <div class="divida-header">
              <h3 class="divida-nome">${divida.nome}</h3>
              <p class="divida-valor">MT ${divida.valor.toFixed(2).replace('.', ',')}</p>
            </div>
            
            <div class="divida-info">
              <span class="divida-categoria categoria-${divida.categoria || 'outro'}">
                ${getNomeCategoria(divida.categoria)}
              </span>
              <span class="divida-status ${statusClass}">${statusLabel}</span>
            </div>
            
            <div class="divida-detalhes">
              ${divida.data ? `<span>📅 ${new Date(divida.data + 'T00:00:00').toLocaleDateString('pt-BR')}</span>` : ''}
              ${divida.prazo ? `<span>⏱️ ${divida.prazo} dias</span>` : ''}
              ${diasInfo}
              ${divida.observacoes ? `<p class="divida-observacoes">💬 ${divida.observacoes}</p>` : ''}
            </div>
            
            <div class="divida-actions">
              ${divida.status === 'pendente' ? 
                `<button class="btn btn-success" onclick="marcarComoRecebido('${divida.id}')">✅ Recebido</button>` :
                `<button class="btn btn-warning" onclick="marcarComoPendente('${divida.id}')">↻ Pendente</button>`
              }
              <button class="btn btn-info" onclick="enviarCobranca('${divida.id}')">📧 Cobrar</button>
              <button class="btn btn-edit" onclick="editarDivida('${divida.id}')">✎ Editar</button>
              <button class="btn btn-danger" onclick="removerDivida('${divida.id}')">✕</button>
            </div>
          </div>
        `;
      }).join('');
    }

    function atualizarFooter() {
      const totalPendente = dividas
        .filter(d => d.status === 'pendente')
        .reduce((sum, d) => sum + d.valor, 0);
      
      const devedoresPendentes = dividas.filter(d => d.status === 'pendente').length;
      const devedoresAtrasados = dividas.filter(d => d.atrasada).length;

      document.getElementById('footer-total').textContent = `MT ${totalPendente.toFixed(2).replace('.', ',')}`;
      document.getElementById('footer-devedores').textContent = devedoresPendentes;
      document.getElementById('footer-atrasadas').textContent = devedoresAtrasados;
    }

    // Funções de prazo e notificações
    function iniciarVerificacaoPrazos() {
      if (lembreteInterval) clearInterval(lembreteInterval);
      lembreteInterval = setInterval(verificarPrazos, 60000);
    }

    function verificarPrazos() {
      const agora = new Date();
      let notificacoesCount = 0;

      dividas.forEach(divida => {
        if (divida.status !== 'pago' && divida.data && divida.prazo) {
          const dataDivida = new Date(divida.data);
          const dataVencimento = new Date(dataDivida);
          dataVencimento.setDate(dataVencimento.getDate() + parseInt(divida.prazo));
          const diasAtraso = Math.floor((agora - dataVencimento) / (1000 * 60 * 60 * 24));
          
          divida.atrasada = diasAtraso > 0;
          if (divida.atrasada) {
            notificacoesCount++;
          }
        }
      });

      // Atualizar badge
      const badge = document.getElementById('notificacao-badge');
      if (notificacoesCount > 0) {
        badge.textContent = notificacoesCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }

      return notificacoesCount;
    }

    // Funções do formulário
    async function handleSubmit(e) {
      e.preventDefault();

      const nome = document.getElementById('input-nome').value.trim();
      const valor = parseFloat(document.getElementById('input-valor').value);
      const categoria = document.getElementById('input-categoria').value;
      const data = document.getElementById('input-data').value;
      const prazo = document.getElementById('input-prazo').value;
      const observacoes = document.getElementById('input-observacoes').value;

      if (!nome || isNaN(valor) || valor <= 0) {
        showToast("Preencha nome e valor válido!", 'warning');
        return;
      }

      const btnSubmit = document.getElementById('btn-submit');
      const btnText = document.getElementById('btn-text-adicionar');
      const originalText = btnText.textContent;

      btnSubmit.disabled = true;
      btnText.innerHTML = '<span class="loading-spinner"></span>';

      await new Promise(resolve => setTimeout(resolve, 300));

      try {
        if (editingId) {
          // Editar dívida existente
          const divida = dividas.find(d => d.id === editingId);
          if (divida) {
            Object.assign(divida, {
              nome, valor, categoria, data, 
              prazo: prazo || null, observacoes
            });
            delete divida.atrasada;
            showToast("Dívida atualizada!", 'success');
          }
        } else {
          // Nova dívida
          const novaDivida = {
            id: Date.now().toString(),
            nome, valor, categoria,
            status: "pendente",
            data, prazo: prazo || null,
            observacoes,
            criadoEm: new Date().toISOString()
          };
          dividas.push(novaDivida);
          showToast(`${nome} registrado como devedor!`, 'success');
        }

        salvarDividas();
        fecharModal();
        document.getElementById('form-devedor').reset();
        editingId = null;
      } catch (error) {
        showToast("Erro ao salvar!", 'danger');
      } finally {
        btnSubmit.disabled = false;
        btnText.textContent = originalText;
      }
    }

    // Funções de ação
    async function marcarComoRecebido(id) {
      const divida = dividas.find(d => d.id === id);
      if (divida) {
        divida.status = 'pago';
        delete divida.atrasada;
        salvarDividas();
        showToast(`✅ MT ${divida.valor.toFixed(2)} recebido de ${divida.nome}!`, 'success');
      }
    }

    async function marcarComoPendente(id) {
      const divida = dividas.find(d => d.id === id);
      if (divida) {
        divida.status = 'pendente';
        salvarDividas();
        showToast(`Dívida de ${divida.nome} restaurada como pendente.`, 'warning');
      }
    }

    function editarDivida(id) {
      const divida = dividas.find(d => d.id === id);
      if (divida) {
        editingId = id;
        document.getElementById('modal-titulo').textContent = '✎ Editar Dívida';
        document.getElementById('btn-text-adicionar').textContent = '💾 Salvar Alterações';
        
        document.getElementById('input-nome').value = divida.nome;
        document.getElementById('input-valor').value = divida.valor;
        document.getElementById('input-categoria').value = divida.categoria || 'emprestimo';
        document.getElementById('input-data').value = divida.data || '';
        document.getElementById('input-prazo').value = divida.prazo || '';
        document.getElementById('input-observacoes').value = divida.observacoes || '';
        
        abrirModal('modal-divida');
      }
    }

    function abrirModalAdicionar() {
      editingId = null;
      document.getElementById('modal-titulo').textContent = '➕ Adicionar Nova Dívida';
      document.getElementById('btn-text-adicionar').textContent = '➕ Adicionar Dívida';
      document.getElementById('form-devedor').reset();
      definirDataAtual();
      abrirModal('modal-divida');
    }

    async function removerDivida(id) {
      const divida = dividas.find(d => d.id === id);
      if (!divida) return;
      
      if (!confirm(`Remover dívida de ${divida.nome}?`)) return;
      
      dividas = dividas.filter(d => d.id !== id);
      if (editingId === id) editingId = null;
      salvarDividas();
      showToast(`Dívida removida!`, 'success');
    }

    // Funções de cobrança
    function enviarCobranca(id) {
      const divida = dividas.find(d => d.id === id);
      if (!divida) return;

      let mensagem = `Olá ${divida.nome}, tudo bem?\n\n`;
      mensagem += `Lembrando que tens uma conta pendente:\n\n`;
      mensagem += `💵 no valor: mzn ${divida.valor.toFixed(2)}\n`;
      mensagem += `📋 referente: ${getNomeCategoria(divida.categoria)}\n`;
      
      if (divida.data) {
        const dataFormatada = new Date(divida.data + 'T00:00:00').toLocaleDateString('pt-BR');
        mensagem += `📅 Data: ${dataFormatada}\n`;
      }
      
      if (divida.atrasada && divida.data && divida.prazo) {
        const dataDivida = new Date(divida.data);
        const dataVencimento = new Date(dataDivida);
        dataVencimento.setDate(dataVencimento.getDate() + parseInt(divida.prazo));
        const agora = new Date();
        const diasAtraso = Math.floor((agora - dataVencimento) / (1000 * 60 * 60 * 24));
        mensagem += `⏰ Atraso: ${diasAtraso} dia(s)\n`;
      }
      
      if (divida.observacoes) {
        mensagem += `📝 Detalhes: ${divida.observacoes}\n`;
      }
      
      mensagem += `\nPor favor, entre em contato para acertarmos.\nAgradeço!`;

      window.mensagemCobrancaAtual = mensagem;
      window.dividaCobrancaAtual = divida;

      document.getElementById('modal-cobranca-titulo').textContent = `📧 Cobrar ${divida.nome}`;
      document.getElementById('modal-cobranca-body').innerHTML = `
        <div style="background: #f7fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
          <p><strong>Mensagem pronta:</strong></p>
          <textarea id="mensagem-cobranca" style="width: 100%; height: 150px; padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: 8px; font-family: inherit; margin: 0.5rem 0; font-size: 0.875rem;">${mensagem}</textarea>
          <p style="font-size: 0.75rem; color: #718096;">Personalize se necessário</p>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-info" onclick="copiarMensagemCobranca()" style="flex: 1;">📋 Copiar</button>
          <button class="btn btn-success" onclick="enviarPorWhatsAppCobranca()" style="flex: 1;">📱 WhatsApp</button>
          <button class="btn btn-primary" onclick="enviarPorEmailCobranca()" style="flex: 1;">✉️ Email</button>
        </div>
        <div id="mensagem-copiada" style="display: none; color: #48bb78; font-size: 0.75rem; margin-top: 0.5rem;">
          ✓ Mensagem copiada!
        </div>
      `;

      abrirModal('modal-cobranca');
    }

    function copiarMensagemCobranca() {
      const textarea = document.getElementById('mensagem-cobranca');
      textarea.select();
      navigator.clipboard.writeText(textarea.value).then(() => {
        const msg = document.getElementById('mensagem-copiada');
        msg.style.display = 'block';
        setTimeout(() => msg.style.display = 'none', 2000);
      });
    }

    function enviarPorWhatsAppCobranca() {
      const mensagem = encodeURIComponent(window.mensagemCobrancaAtual);
      window.open(`https://wa.me/?text=${mensagem}`, '_blank');
      showToast("Abrindo WhatsApp!", 'success');
      fecharModal();
    }

    function enviarPorEmailCobranca() {
      const divida = window.dividaCobrancaAtual;
      const assunto = encodeURIComponent(`Lembrete de Pagamento - ${divida.nome}`);
      const corpo = encodeURIComponent(window.mensagemCobrancaAtual);
      window.open(`mailto:?subject=${assunto}&body=${corpo}`, '_blank');
      showToast("Abrindo email!", 'success');
      fecharModal();
    }

    // Funções auxiliares
    function getNomeCategoria(codigo) {
      const categorias = {
        'emprestimo': '💰 Empréstimo',
        'servico': '🔧 Serviço',
        'venda': '🛒 Venda',
        'outro': '📝 Outro'
      };
      return categorias[codigo] || '📝 Outro';
    }

    function definirDataAtual() {
      const hoje = new Date().toISOString().split('T')[0];
      if (!editingId) {
        document.getElementById('input-data').value = hoje;
      }
    }

    function filtrarDividas(filtro) {
      filtroAtual = filtro;
      atualizarListaDividas();
    }

    function mostrarNotificacoes() {
      const notificacoesCount = verificarPrazos();
      document.getElementById('modal-notificacoes-body').innerHTML = `
        <div style="text-align: center; padding: 1rem;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">${notificacoesCount > 0 ? '🔔' : '✅'}</div>
          <h3 style="color: #2d3748; margin: 0 0 0.5rem 0;">${notificacoesCount > 0 ? 'Cobranças Pendentes' : 'Tudo em dia!'}</h3>
          <p>${notificacoesCount > 0 ? `${notificacoesCount} dívida(s) atrasada(s)` : 'Nenhuma cobrança pendente'}</p>
        </div>
      `;
      abrirModal('modal-notificacoes');
    }

    function abrirModal(modalId) {
      document.getElementById(modalId).style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function fecharModal() {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
      document.body.style.overflow = 'auto';
      editingId = null;
    }

    function showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => toast.remove(), 3000);
    }

    // Fechar modal ao clicar fora
    window.addEventListener('click', (event) => {
      if (event.target.classList.contains('modal')) {
        fecharModal();
      }
    });

    // Solicitar permissão para notificações
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }