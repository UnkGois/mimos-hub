from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cliente import Cliente
from app.schemas.cliente import ClienteCreate, ClienteUpdate
from app.utils.formatters import limpar_cpf, limpar_telefone


async def listar_clientes(
    db: AsyncSession,
    nome: str | None = None,
    cpf: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[Cliente], int]:
    query = select(Cliente)
    count_query = select(func.count(Cliente.id))

    if nome:
        query = query.where(Cliente.nome.ilike(f"%{nome}%"))
        count_query = count_query.where(Cliente.nome.ilike(f"%{nome}%"))
    if cpf:
        cpf_limpo = limpar_cpf(cpf)
        query = query.where(Cliente.cpf == cpf_limpo)
        count_query = count_query.where(Cliente.cpf == cpf_limpo)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(Cliente.criado_em.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all(), total


async def buscar_cliente_por_cpf(db: AsyncSession, cpf: str) -> Cliente | None:
    cpf_limpo = limpar_cpf(cpf)
    result = await db.execute(select(Cliente).where(Cliente.cpf == cpf_limpo))
    return result.scalar_one_or_none()


async def obter_cliente(db: AsyncSession, cliente_id: int) -> Cliente:
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado",
        )
    return cliente


async def criar_cliente(db: AsyncSession, dados: ClienteCreate) -> Cliente:
    cpf_limpo = limpar_cpf(dados.cpf)
    existente = await buscar_cliente_por_cpf(db, cpf_limpo)
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CPF já cadastrado",
        )

    cliente = Cliente(
        cpf=cpf_limpo,
        nome=dados.nome,
        telefone=limpar_telefone(dados.telefone),
        data_nascimento=dados.data_nascimento,
        email=dados.email,
        cep=limpar_telefone(dados.cep) if dados.cep else None,
        endereco=dados.endereco,
        numero=dados.numero,
        complemento=dados.complemento,
        bairro=dados.bairro,
        cidade=dados.cidade,
        uf=dados.uf,
    )
    db.add(cliente)
    await db.commit()
    await db.refresh(cliente)
    return cliente


async def atualizar_cliente(
    db: AsyncSession, cliente_id: int, dados: ClienteUpdate
) -> Cliente:
    cliente = await obter_cliente(db, cliente_id)

    update_data = dados.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            if field == "cpf":
                value = limpar_cpf(value)
            if field == "telefone":
                value = limpar_telefone(value)
            if field == "cep" and value:
                value = limpar_telefone(value)
            setattr(cliente, field, value)

    await db.commit()
    await db.refresh(cliente)
    return cliente


async def incrementar_compras(db: AsyncSession, cliente_id: int) -> Cliente:
    cliente = await obter_cliente(db, cliente_id)
    cliente.total_compras = (cliente.total_compras or 0) + 1
    await db.commit()
    await db.refresh(cliente)
    return cliente
