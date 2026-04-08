import { AssetType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthSession } from '@/lib/auth/session';

async function getCurrentCcl() {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/contadoconliqui', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const value = Number((data as any).venta ?? null);
      if (Number.isFinite(value) && value > 0) return value;
    }
  } catch {}
  return null;
}

export async function GET() {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const assets = await prisma.asset.findMany({ where: { userId }, orderBy: { id: 'desc' } });
  return NextResponse.json({ ok: true, assets });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const symbol = body?.symbol?.trim()?.toUpperCase();
  const assetType = body?.assetType as AssetType;
  const quantity = Number(body?.quantity || 0);
  const purchasePrice = Number(body?.purchasePrice || 0);
  let purchaseCcl = Number(body?.purchaseCcl ?? null);
  const currency = body?.currency?.trim() || 'ARS';
  const accountId = body?.accountId?.trim() || null;

  if (!symbol || !assetType || !Object.values(AssetType).includes(assetType) || quantity <= 0 || purchasePrice <= 0) {
    return NextResponse.json({ message: 'Datos inválidos para crear inversión.' }, { status: 400 });
  }

  if (assetType === 'CEDEAR' && (!Number.isFinite(purchaseCcl) || purchaseCcl <= 0)) {
    const currentCcl = await getCurrentCcl();
    purchaseCcl = currentCcl ?? Number.NaN;
  }

  const portfolio = await prisma.portfolio.findFirst({ where: { userId } })
    ?? await prisma.portfolio.create({ data: { userId, name: 'Portfolio Principal' } });

  if (accountId) {
    const account = await prisma.holdingAccount.findFirst({ where: { id: accountId, userId } });
    if (!account) return NextResponse.json({ message: 'Cuenta inválida.' }, { status: 400 });
  }

  const asset = await prisma.asset.create({
    data: {
      userId,
      portfolioId: portfolio.id,
      accountId,
      symbol,
      ticker: symbol,
      assetType,
      quantity,
      purchasePrice,
      purchaseCcl: Number.isFinite(purchaseCcl) && purchaseCcl > 0 ? purchaseCcl : null,
      currency,
    },
  });

  return NextResponse.json({ ok: true, asset }, { status: 201 });
}
