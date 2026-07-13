export const POS_APP_ID = "posawesome";
export const POS_BRAND_NAME = "RetailMind-POS";
export const POS_BRAND_SHORT_NAME = "RM-POS";

export function getPosAppDisplayName(appName: string) {
	return appName === POS_APP_ID ? POS_BRAND_NAME : appName;
}
