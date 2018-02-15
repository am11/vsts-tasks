import * as os from 'os';
import * as tl from 'vsts-task-lib/task';
import * as URL from 'url';

import { NormalizeRegistry } from './npmrcparser';
import * as util from './util';

export interface INpmRegistry {
    url: string;
    auth: string;
    authOnly: boolean;
}

export class NpmRegistry implements INpmRegistry {
    public url: string;
    public auth: string;
    public authOnly: boolean;

    constructor(url: string, auth: string, authOnly?: boolean) {
        this.url = url;
        this.auth = auth;
        this.authOnly = authOnly || false;
    }

    public static FromServiceEndpoint(endpointId: string, authOnly?: boolean): NpmRegistry {
        let lineEnd = os.EOL;
        let endpointAuth: tl.EndpointAuthorization;
        let url: string;
        let nerfed: string;
        let auth: string;
        let username: string;
        let password: string;
        let email: string;
        let password64: string;
        try {
            endpointAuth = tl.getEndpointAuthorization(endpointId, false);
        } catch (exception) {
            throw new Error(tl.loc('ServiceEndpointNotDefined'));
        }

        try {
            url = NormalizeRegistry(tl.getEndpointUrl(endpointId, false));
            if (endpointAuth.scheme === 'Token' &&
                URL.parse(url).hostname.toUpperCase().endsWith('.VISUALSTUDIO.COM')){
                // VSTS does not support a PAT in _authToken.  Therefore, you must do basic.
                endpointAuth.scheme = 'CrossAccount';
            }
            nerfed = util.toNerfDart(url);
        } catch (exception) {
            throw new Error(tl.loc('ServiceEndpointUrlNotDefined'));
        }

        switch (endpointAuth.scheme) {
            case 'UsernamePassword':
                username = endpointAuth.parameters['username'];
                password = endpointAuth.parameters['password'];
                email = username; // npm needs an email to be set in order to publish, this is ignored on npmjs
                password64 = (new Buffer(password).toString('base64'));

                auth = nerfed + ":username=" + username + lineEnd;
                auth += nerfed + ":_password=" + password64 + lineEnd;
                auth += nerfed + ":email=" + email + lineEnd;
                break;
            case 'CrossAccount':
                email = 'VssEmail';
                username = 'VssToken';
                password = endpointAuth.parameters['apitoken'];
                password64 = (new Buffer(password).toString('base64'));

                auth = nerfed + ":username=" + username + lineEnd;
                auth += nerfed + ":_password=" + password64 + lineEnd;
                auth += nerfed + ":email=" + email + lineEnd;
                break;
            case 'Token':
                let apitoken = endpointAuth.parameters['apitoken'];
                auth = nerfed + ":_authToken=" + apitoken + lineEnd;
                break;
        }

        auth += nerfed + ":always-auth=true";
        return new NpmRegistry(url, auth, authOnly);
    }

    public static async FromFeedId(feedId: string, authOnly?: boolean): Promise<NpmRegistry> {
        let url = NormalizeRegistry(await util.getFeedRegistryUrl(feedId));
        let nerfed = util.toNerfDart(url);
        let auth = `${nerfed}:_authToken=${util.getSystemAccessToken()}`;

        return new NpmRegistry(url, auth, authOnly);
    }
}
