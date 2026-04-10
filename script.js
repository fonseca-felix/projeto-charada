// Este arquivo contém o código JavaScript para o jogo de charadas.
// O jogo permite dois modos: casual (sem tempo) e time (com timer de 30 segundos).
// O jogador responde charadas obtidas de uma API, e o placar é atualizado com acertos e erros.
// Inclui animações visuais para feedback e bloqueio de input durante transições.

// Capturando os elementos HTML do novo layout
// Aqui são selecionados todos os elementos do DOM necessários para o jogo,
// incluindo telas, botões, campos de entrada e displays de placar e timer.
const menuScreen = document.getElementById("menu-screen");
const gameScreen = document.getElementById("game-screen");

const btnCasual = document.getElementById("btn-casual");
const btnTime = document.getElementById("btn-time");
const btnGiveUp = document.getElementById("btn-giveup");

const scoreCorrectEl = document.getElementById("score-correct");
const scoreWrongEl = document.getElementById("score-wrong");
const timerContainer = document.getElementById("timer-container");
const timerEl = document.getElementById("timer");

const campoPergunta = document.getElementById("pergunta");
const answerInput = document.getElementById("answer-input");
const btnSubmit = document.getElementById("btn-submit");
const gameCard = document.getElementById("game-card");
const feedbackMsg = document.getElementById("feedback-msg");

// --- Estado Global do Jogo ---
// Objeto que armazena o estado atual do jogo, incluindo placar, modo selecionado,
// charada atual, tempo restante e flags de bloqueio para evitar ações simultâneas.
let gameState = {
    acertos: 0,
    erros: 0,
    modo: 'casual', // 'casual' ou 'time'
    charadaAtual: null,
    tempoRestante: 30,
    intervalo: null,
    bloqueado: false // Bloqueia input do botão/enter enquanto anima ou carrega
};

// --- Event Listeners ---
// Adiciona ouvintes de eventos aos botões e campo de entrada.
// Permite iniciar o jogo em diferentes modos, voltar ao menu e enviar respostas.
btnCasual.addEventListener('click', () => inciarJogo('casual'));
btnTime.addEventListener('click', () => inciarJogo('time'));
btnGiveUp.addEventListener('click', voltarMenu);

btnSubmit.addEventListener('click', enviarResposta);
answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enviarResposta();
});

// --- Funções de Navegação e Setup ---
// Funções para iniciar o jogo em um modo específico, resetar o estado,
// trocar entre telas e configurar o HUD (heads-up display) conforme o modo.
function inciarJogo(modo) {
    // Define o modo do jogo (casual ou time), reseta o placar e atualiza a interface.
    // Troca para a tela do jogo e configura o timer se necessário.
    gameState.modo = modo;
    gameState.acertos = 0;
    gameState.erros = 0;
    atualizarPlacar();

    // Troca de Telas
    menuScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    gameScreen.classList.add('flex');

    // Configurando HUD do modo tempo
    if (modo === 'time') {
        timerContainer.classList.remove('hidden');
        timerContainer.classList.add('flex');
    } else {
        timerContainer.classList.add('hidden');
        timerContainer.classList.remove('flex');
    }

    buscaCharada();
}

function voltarMenu() {
    // Para o timer se estiver rodando e volta para a tela do menu.
    pararTimer();
    gameScreen.classList.add('hidden');
    gameScreen.classList.remove('flex');
    menuScreen.classList.remove('hidden');
}

// --- Funções Core API ---
// Função assíncrona para buscar uma charada aleatória da API.
// Trata erros de conexão e tenta novamente se necessário.
async function buscaCharada() {
    // Bloqueia input, para o timer e mostra mensagem de carregamento.
    // Faz requisição para a API, processa a resposta e inicia o timer se no modo time.
    bloquearInput(true);
    pararTimer();

    campoPergunta.textContent = "Buscando nos arquivos de Gotham...";
    answerInput.value = "";

    try {
        const baseUrl = 'https://charada-orpin.vercel.app';
        const endPoint = '/charadas/aleatoria';
        const respostaApi = await fetch(baseUrl + endPoint);
        const dados = await respostaApi.json();

        gameState.charadaAtual = dados;
        campoPergunta.textContent = `"${dados.pergunta}"`;

        bloquearInput(false);
        answerInput.focus(); // Foca automaticamente pro usuário digitar

        if (gameState.modo === 'time') {
            iniciarTimer();
        }

    } catch (erro) {
        campoPergunta.textContent = "Falha na conexão. A rede está comprometida.";
        console.error("Erro na busca da API:", erro);
        // Tenta buscar de novo após 3 segundos caso a Vercel demore a acordar
        setTimeout(buscaCharada, 3000);
    }
}

// --- Sistema de Validação Flexível ---
// Funções para normalizar texto (remover acentos, pontuação) e verificar se a resposta do usuário está correta.
// Permite flexibilidade, aceitando variações da resposta.
function normalizarTexto(texto) {
    // Normaliza o texto para comparação: converte para minúsculas, remove acentos e pontuação.
    if (!texto) return "";
    return texto
        .toLowerCase()
        // Remove acertos ortográficos comuns e pontuações
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // sem acentos
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // sem pontuação
        .trim();
}

function verificarResposta(digitado, correta) {
    // Verifica se a resposta digitada pelo usuário corresponde à correta.
    // Primeiro, compara exatamente após normalização.
    // Se não, verifica se contém palavras-chave principais.
    const digitadoNorm = normalizarTexto(digitado);
    const corretaNorm = normalizarTexto(correta);

    // Critério 1: Exatamente igual ignorando acentos
    if (digitadoNorm === corretaNorm) return true;

    // Critério 2: Inteligência básica - Se conter a palavra-chave principal da resposta API
    // Ex: API = "O eco". Usuario = "eco". palavra limpa = "eco" (tamanho > 2 removes 'o', 'a')
    const palavrasCorretas = corretaNorm.split(' ').filter(p => p.length > 2);

    for (let palavra of palavrasCorretas) {
        if (digitadoNorm.includes(palavra)) {
            return true;
        }
    }

    return false;
}

// --- Processamento da Jogada ---
// Funções para enviar a resposta, processar acertos e erros,
// atualizar o placar e mostrar feedback visual.
function enviarResposta() {
    // Verifica se o input não está bloqueado e se há uma resposta digitada.
    // Para o timer, verifica a resposta e processa como acerto ou erro.
    // Evita double click
    if (gameState.bloqueado || !gameState.charadaAtual || !answerInput.value.trim()) return;

    bloquearInput(true);
    pararTimer();

    const textDigitado = answerInput.value;
    const isCorrect = verificarResposta(textDigitado, gameState.charadaAtual.resposta);

    if (isCorrect) {
        processarAcerto();
    } else {
        processarErro(`Era esperado: ${gameState.charadaAtual.resposta}`);
    }
}

function processarAcerto() {
    // Incrementa acertos, atualiza placar, mostra animação de sucesso e busca nova charada.
    gameState.acertos++;
    atualizarPlacar();

    // Animação de sucesso (Glow verde pisca)
    gameCard.classList.add('correct-glow');
    mostrarFeedback("CORRETO. Uma mente brilhante...", "text-green-400");

    setTimeout(() => {
        gameCard.classList.remove('correct-glow');
        buscaCharada();
    }, 2000);
}

function processarErro(mensagemExtra = "") {
    // Incrementa erros, atualiza placar, mostra animação de erro e busca nova charada.
    gameState.erros++;
    atualizarPlacar();

    // Animação de Erro (Shake e borda vermelha)
    gameCard.classList.add('shake');
    gameCard.classList.replace('border-green-500', 'border-red-600');
    mostrarFeedback(`ERRADO. ${mensagemExtra}`, "text-red-500");

    setTimeout(() => {
        gameCard.classList.remove('shake');
        gameCard.classList.replace('border-red-600', 'border-green-500');
        buscaCharada();
    }, 3000); // Dá tempo do usuário ler qual era a charada correta
}

function atualizarPlacar() {
    // Atualiza os elementos HTML do placar com os valores atuais de acertos e erros.
    scoreCorrectEl.textContent = gameState.acertos;
    scoreWrongEl.textContent = gameState.erros;
}

function mostrarFeedback(texto, corClasse) {
    // Exibe uma mensagem de feedback na tela com a cor especificada.
    // A mensagem desaparece após alguns segundos.
    feedbackMsg.textContent = texto;
    // Reseta as classes temporárias
    feedbackMsg.className = `absolute bottom-6 left-0 right-0 text-xl font-bold transition-opacity duration-300 opacity-100 drop-shadow-lg ${corClasse}`;

    setTimeout(() => {
        feedbackMsg.classList.remove('opacity-100');
        feedbackMsg.classList.add('opacity-0');
    }, 2800);
}

function bloquearInput(estado) {
    // Bloqueia ou desbloqueia o input do usuário e o botão de submit.
    // Adiciona classes visuais para indicar o estado bloqueado.
    gameState.bloqueado = estado;
    answerInput.disabled = estado;
    btnSubmit.disabled = estado;
    if (estado) {
        btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

// --- Mecânica de Tempo ---
// Funções para gerenciar o timer no modo time: iniciar, parar e atualizar o display.
function iniciarTimer() {
    // Inicia o timer com 30 segundos, atualiza o display a cada segundo.
    // Muda a cor para vermelho nos últimos 10 segundos e processa erro se acabar o tempo.
    gameState.tempoRestante = 30;
    atualizarDisplayTimer();

    // Reseta visual se estiver vermelho do turno passado
    timerEl.classList.remove('text-red-500');
    timerEl.classList.add('text-white');

    gameState.intervalo = setInterval(() => {
        gameState.tempoRestante--;
        atualizarDisplayTimer();

        // Warning time
        if (gameState.tempoRestante <= 10) {
            timerEl.classList.remove('text-white');
            timerEl.classList.add('text-red-500');
        }

        // Time Over
        if (gameState.tempoRestante <= 0) {
            pararTimer();
            bloquearInput(true);
            processarErro(`TEMPO ESGOTADO! A resposta era: ${gameState.charadaAtual.resposta}`);
        }
    }, 1000);
}

function pararTimer() {
    // Para o intervalo do timer se estiver ativo.
    if (gameState.intervalo) {
        clearInterval(gameState.intervalo);
        gameState.intervalo = null;
    }
}

function atualizarDisplayTimer() {
    // Atualiza o display do timer com o tempo restante, formatado com dois dígitos.
    // PadStart para ficar visualmente fixo tipo 09, 08...
    timerEl.textContent = gameState.tempoRestante.toString().padStart(2, '0');
}
