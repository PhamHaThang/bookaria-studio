import axios from 'axios';
import { ApiErrorSchema, AssetInUseDetailsSchema } from '../../../shared/contracts/error.schema';

export function assetInUse(error: unknown) {
    if (!axios.isAxiosError(error)) return [];
    const parsed = ApiErrorSchema.safeParse(error.response?.data);
    if (!parsed.success || parsed.data.error.code !== 'ASSET_IN_USE') return [];
    const details = AssetInUseDetailsSchema.safeParse(parsed.data.error.details);
    return details.success ? details.data.usages : [];
}
