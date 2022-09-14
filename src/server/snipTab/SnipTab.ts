import { PreventIframe } from "express-msteams-host";

/**
 * Used as place holder for the decorators
 */
@PreventIframe("/snipTab/index.html")
@PreventIframe("/snipTab/config.html")
@PreventIframe("/snipTab/remove.html")
export class SnipTab {
}
