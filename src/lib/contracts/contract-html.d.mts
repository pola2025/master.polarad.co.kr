// contract-html.mjs 타입 선언 (Next/TS에서 import용)
export interface ContractBuilderData {
  partyAName?: string;
  partyABizName?: string;
  partyACeo?: string;
  partyABizNo?: string;
  partyACorpNo?: string;
  partyAAddr?: string;
  partyAPhone?: string;
  partyAEmail?: string;
  monthlyFee: number;
  periodMonths: number;
  planLabel?: string;
  projectName?: string;
  paymentMethod?: string;
  specialTerms?: string[];
  clientSignature?: string;
  signDate?: string;
}
export function buildContractHtml(data: ContractBuilderData): string;
export function escapeHtml(value: unknown): string;
export const TEMPLATE_PATH: string;
export const SEAL_PATH: string;
