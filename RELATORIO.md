# Relatório do Projeto — DesapegaUai

| | |
| --- | --- |
| **Projeto** | _(título oficial do projeto de extensão)_ |
| **Tema** | Cidades Inteligentes |
| **Curso** | Análise e Desenvolvimento de Sistemas |
| **Equipe** | _(nomes dos integrantes)_ |
| **Período** | _(mês/ano de início e de entrega)_ |

## 1. Introdução

O DesapegaUai é uma plataforma web de classificados locais — um marketplace C2C hiperlocal — que conecta quem quer vender produtos usados a compradores da mesma região: Viçosa e as cidades da Zona da Mata mineira. A plataforma aproxima as pessoas, e a negociação, o pagamento e a entrega são combinados diretamente entre comprador e vendedor.

## 2. Objetivos

### 2.1 Objetivo geral

Desenvolver uma plataforma web responsiva de compra e venda de produtos usados entre moradores de Viçosa e região, que estimule o reaproveitamento de bens e a economia circular.

### 2.2 Objetivos específicos

- Permitir que qualquer pessoa pesquise e visualize anúncios sem precisar de cadastro.
- Permitir o acesso com a conta Google para publicar anúncios, favoritar produtos e conversar com o vendedor.
- Priorizar anúncios próximos ao usuário, a partir do bairro informado no anúncio.
- Oferecer à região um canal de classificados independente das redes sociais.
- Apresentar a plataforma à comunidade em um workshop.

## 3. Justificativa

Em Viçosa, a compra e venda de usados acontece principalmente em grupos de redes sociais, onde os anúncios se perdem rapidamente e a busca é limitada. Ao mesmo tempo, a cidade recebe e despede estudantes a cada semestre: quem chega precisa montar a casa com pouco dinheiro, e quem vai embora precisa se desfazer dos móveis e objetos em pouco tempo.

O DesapegaUai organiza essa troca em um só lugar e, alinhado ao tema Cidades Inteligentes, usa a tecnologia para fortalecer a economia local e reduzir o desperdício:

> alguém desapega → outra pessoa encontra → compra localmente → o produto continua em uso → menos desperdício.

## 4. Público-alvo

Moradores de Viçosa e da Zona da Mata mineira, com destaque para os estudantes universitários. Duas personas orientaram o projeto:

- **Larissa Andrade (compradora):** 19 anos, no 1º período, recém-chegada a Viçosa, mora em uma república no bairro Ramos e quer montar o quarto gastando cerca de R$ 500, em vez de R$ 2.000 em produtos novos.
- **Diego Martins (vendedor):** 23 anos, no 9º período, vai sair da cidade em 3 semanas e precisa esvaziar o apartamento rápido.

## 5. Escopo do MVP

| Módulo | Funcionalidades |
| --- | --- |
| Acesso público | Fazer login com Google, pesquisar anúncios, filtrar anúncios, visualizar categorias, visualizar anúncio |
| Anúncios | Publicar anúncio, visualizar meus anúncios, editar, excluir |
| Favoritos | Favoritar, visualizar favoritos, remover dos favoritos |
| Negociação / Chat | Entrar em contato com o vendedor, trocar mensagens pelo chat |
| Perfil | Visualizar e editar o perfil |
| Sessão | Fazer logout |

**Fora do escopo desta versão:** cadastro com e-mail e senha, processamento de pagamento e entrega ou frete.

### Principais decisões

- **Login só com Google:** não há cadastro tradicional com senha.
- **Sem pagamento e sem entrega pela plataforma:** comprador e vendedor combinam entre si.
- **Proximidade por bairro:** o anúncio guarda o bairro, escolhido de uma lista fixa com coordenadas, e a distância é calculada a partir dele, sem GPS nem serviço de geolocalização.
- **Plataforma web responsiva**, e não aplicativo: funciona no computador, no celular e no tablet.

## 6. Modelagem

| Artefato | Situação |
| --- | --- |
| Diagrama de casos de uso | _(concluído / anexar)_ |
| Diagrama de atividades | _(concluído / anexar)_ |
| Diagrama de estados | _(concluído / anexar)_ |
| Diagrama de classes | _(a fazer)_ |
| Modelo do banco de dados | _(a fazer)_ |

## 7. Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Front-end | React + Vite |
| Back-end | Node.js + Express |
| Banco de dados | MySQL |
| Hospedagem | _(preencher)_ |
| Versionamento | Git e GitHub |
| Gestão das tarefas | Trello |

## 8. Metodologia e organização da equipe

O desenvolvimento foi organizado em sprints, com as tarefas no Trello e o código no GitHub.

| Integrante | Papel | Principais contribuições |
| --- | --- | --- |
| _(nome)_ | _(papel)_ | _(o que fez)_ |
| _(nome)_ | _(papel)_ | _(o que fez)_ |

| Sprint | Período | Entregas |
| --- | --- | --- |
| 1 | _(datas)_ | _(o que foi entregue)_ |
| 2 | _(datas)_ | _(o que foi entregue)_ |

## 9. Testes

| O que foi testado | Como | Resultado |
| --- | --- | --- |
| Funcionalidades de cada módulo | _(teste manual / automatizado)_ | _(resultado)_ |
| Responsividade | Telas de 360, 768 e 1280 px | _(resultado)_ |
| Navegadores | _(ex.: Chrome, Firefox, Safari)_ | _(resultado)_ |

## 10. Resultados

_(Prints das principais telas, o que ficou pronto no MVP e o resultado do workshop: número de participantes e retorno da comunidade.)_

## 11. Considerações finais e próximos passos

_(O que o projeto alcançou, as dificuldades da equipe e o que pode vir em uma próxima versão.)_

## 12. Referências

- BRASIL. Lei nº 13.709, de 14 de agosto de 2018. Lei Geral de Proteção de Dados Pessoais (LGPD).
- _(adicionar as demais referências usadas)_
