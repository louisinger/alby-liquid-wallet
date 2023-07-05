export interface LiquidProvider {
  getAddress(): Promise<{
    address: string;
    blindingPrivateKey: string;
    publicKey: string;
  }>;
  signPset(psetBase64: string): Promise<string>;
}

type LiquidProviderWithEnable = LiquidProvider & {
  enable: () => Promise<void>;
};

function detectAlbyProvider(): LiquidProviderWithEnable {
  const provider = window['liquid'];
  if (!provider) {
    throw new Error('window.liquid provider not found');
  }
  return provider as unknown as LiquidProviderWithEnable;
}

async function safeDetectProvider(
  retry = 5
): Promise<LiquidProviderWithEnable> {
  let fails = 0;
  while (fails < retry) {
    try {
      return detectAlbyProvider();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      fails++;
    }
  }

  throw new Error('window.liquid provider not found');
}

export class AlbyLiquidProvider implements LiquidProvider {
  private constructor(private provider: LiquidProviderWithEnable) {}

  static async enable(): Promise<AlbyLiquidProvider> {
    const provider = await safeDetectProvider();
    await provider.enable();
    return new AlbyLiquidProvider(provider);
  }

  getAddress(): Promise<{
    address: string;
    blindingPrivateKey: string;
    publicKey: string;
  }> {
    return this.provider.getAddress();
  }

  async signPset(psetBase64: string): Promise<string> {
    const res = await this.provider.signPset(psetBase64);
    if (!res['signed']) throw new Error('signPset failed');
    return res['signed'];
  }
}
