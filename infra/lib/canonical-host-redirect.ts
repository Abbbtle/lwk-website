import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

export type CanonicalHostRedirectProps = {
  /** The host name to serve, for example "dev.livingwithkrishna.com". */
  canonicalHostName: string;
  /** Describes the function in the CloudFront console. */
  comment: string;
};

// A lowercase DNS host name: labels of letters, digits and inner hyphens, separated by dots.
const HOST_NAME =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/**
 * A CloudFront Function that permanently redirects requests for any other host name (the
 * distribution's own address, or `www`) to the same path and query string on the canonical host
 * name. Attach `functionAssociation` to every cache behavior of the distribution.
 */
export class CanonicalHostRedirect extends Construct {
  readonly functionAssociation: cloudfront.FunctionAssociation;

  constructor(scope: Construct, id: string, props: CanonicalHostRedirectProps) {
    super(scope, id);
    if (!HOST_NAME.test(props.canonicalHostName)) {
      throw new Error(`Not a lowercase host name: ${props.canonicalHostName}`);
    }
    const redirect = new cloudfront.Function(this, 'Function', {
      comment: props.comment,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(handlerSource(props.canonicalHostName)),
    });
    this.functionAssociation = {
      function: redirect,
      eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
    };
  }
}

/**
 * The viewer-request handler. Query string values reach CloudFront Functions still URL-encoded,
 * so they are joined back unchanged (re-encoding would double-encode them), keeping every value
 * of a repeated parameter.
 */
function handlerSource(canonicalHostName: string): string {
  return `function handler(event) {
  var request = event.request;
  var host = request.headers.host ? request.headers.host.value.toLowerCase() : '';
  if (host === '${canonicalHostName}') {
    return request;
  }
  var query = Object.keys(request.querystring).map(function (name) {
    var parameter = request.querystring[name];
    var values = parameter.multiValue || [parameter];
    return values.map(function (item) { return name + '=' + item.value; }).join('&');
  }).join('&');
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: 'https://${canonicalHostName}' + request.uri + (query ? '?' + query : '') }
    }
  };
}`;
}
