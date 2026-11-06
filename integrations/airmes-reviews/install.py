#!/usr/bin/env python3
"""Export or install the n8n reviews workflow. Map publication uses the project build."""
import argparse
import json
import os
from pathlib import Path
import shlex
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
# Keep existing installation records and private backups in their original location.
STATE = Path.home() / '.local/state/workadventure/mr-map'


class InstallationError(Exception):
    """A diagnostic that never includes request headers or upstream response bodies."""


def save_private(path, value):
    if path.resolve().is_relative_to(PROJECT):
        raise InstallationError('Private installation records must remain outside the map project')
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    path.parent.chmod(0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'w') as out:
        os.fchmod(out.fileno(), 0o600)
        json.dump(value, out, indent=2, ensure_ascii=False)
        out.write('\n')


def configuration(path):
    if path.stat().st_mode & 0o077 or path.stat().st_uid != os.getuid():
        raise InstallationError('Credential file must belong to you and have owner-only permissions')
    result = {}
    for line in path.read_text().splitlines():
        line = line.strip().removeprefix('export ')
        if not line or line.startswith('#'):
            continue
        key, separator, value = line.partition('=')
        if not separator:
            raise InstallationError('Invalid credential file format')
        try:
            parts = shlex.split(value, comments=True)
        except ValueError:
            raise InstallationError('Invalid quoted credential value') from None
        if len(parts) != 1:
            raise InstallationError('Invalid credential value')
        result[key.strip()] = parts[0]
    return result


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class N8n:
    def __init__(self):
        values = configuration(Path.home() / '.config/n8n.env')
        parsed = urllib.parse.urlsplit(values.get('URL', ''))
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or not values.get('TOKEN'):
            raise InstallationError('An HTTPS n8n URL without embedded credentials and a TOKEN are required')
        self.origin = f'{parsed.scheme}://{parsed.netloc}'
        self.token = values['TOKEN']
        self.opener = urllib.request.build_opener(NoRedirect)

    def api(self, path, method='GET', data=None):
        request = urllib.request.Request(self.origin + '/api/v1/' + path, method=method,
            data=json.dumps(data).encode() if data is not None else None,
            headers={'X-N8N-API-KEY': self.token, 'Content-Type': 'application/json'})
        try:
            with self.opener.open(request, timeout=45) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise InstallationError(f'n8n API returned HTTP {error.code}') from None
        except (OSError, ValueError):
            raise InstallationError('n8n API unavailable or invalid response') from None


def workflow(credentials, feed_path):
    nodes = []
    links = {}

    def node(name, kind, parameters, version=1, **extra):
        nodes.append(dict(id=str(uuid.uuid5(uuid.NAMESPACE_URL, 'airmes-reviews/node/' + name)), name=name, type='n8n-nodes-base.' + kind,
            typeVersion=version, position=[len(nodes) * 220, 0], parameters=parameters, **extra))

    def connect(source, target, output=0):
        main = links.setdefault(source, {'main': []})['main']
        while len(main) <= output:
            main.append([])
        main[output].append(dict(node=target, type='main', index=0))

    def http(name, url, pagination=False):
        options = dict(timeout=20000, response={'response': {'fullResponse': True, 'responseFormat': 'json'}},
                       redirect={'redirect': {'followRedirects': False}})
        if pagination:
            options['pagination'] = {'pagination': dict(paginationMode='updateAParameterInEachRequest',
                parameters={'parameters': [dict(type='qs', name='page', value='={{ $pageCount + 1 }}')]},
                paginationCompleteWhen='other', completeExpression='={{ $response.body.length < 100 }}',
                requestInterval=100)}
        node(name, 'httpRequest', dict(method='GET', url=url, authentication='predefinedCredentialType',
            nodeCredentialType='gitlabApi', options=options), 4.2, credentials=credentials)

    node('Chaque minute', 'scheduleTrigger', {'rule': {'interval': [{'field': 'minutes', 'minutesInterval': 1}]}}, 1.2)
    http('MR ouvertes', 'https://gitlab.eoloa.eu/api/v4/projects/6/merge_requests?state=opened&per_page=100', True)
    http('Environnements', 'https://gitlab.eoloa.eu/api/v4/projects/6/environments?states=available&per_page=100', True)
    nodes[-1]['executeOnce'] = True
    node('Reviews disponibles', 'code', {'jsCode': "const envs = $input.all().flatMap(i => i.json.body).filter(e => e?.name?.startsWith('review/')); return envs.length ? envs.map(e => ({json:e})) : [{json:{empty:true}}];"}, 2)
    node('Au moins une review', 'if', {'conditions': {'options': {'caseSensitive': True, 'typeValidation': 'strict'},
        'conditions': [{'id': str(uuid.uuid5(uuid.NAMESPACE_URL, 'airmes-reviews/condition/has-review')), 'leftValue': '={{ $json.empty !== true }}', 'rightValue': '',
                        'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'options': {}}, 2.2)
    http('Détail des déploiements', "=https://gitlab.eoloa.eu/api/v4/projects/6/environments/{{ $json.id }}")
    source = (HERE / 'snapshot.cjs').read_text().split('module.exports =')[0]
    source += "\nconst data = $getWorkflowStaticData('global');\nconst mrs = $('MR ouvertes').all().flatMap(i => i.json.body);\nif (mrs.some(m => !Number.isInteger(m.iid))) throw new Error('Invalid GitLab MR response');\nconst envs = $input.all().map(i => i.json.body).filter(Boolean);\ndata.snapshot = buildSnapshot(mrs, envs, data.snapshot);\nreturn [{json:{updatedAt:data.snapshot.updatedAt, available:data.snapshot.available}}];"
    node('Mémoriser les postes', 'code', {'jsCode': source}, 2)
    node('Flux pour la map', 'webhook', dict(httpMethod='GET', path=feed_path,
         responseMode='responseNode', options={'allowedOrigins': '*'}), 2, webhookId=str(uuid.uuid5(uuid.NAMESPACE_URL, 'airmes-reviews/webhook/' + feed_path)))
    node('Lire le dernier état', 'code', {'jsCode': "const snapshot = $getWorkflowStaticData('global').snapshot; return [{json: snapshot || {version:1, updatedAt:'1970-01-01T00:00:00.000Z',totalOpen:0,available:0,overflow:0,reviews:[]}}];"}, 2)
    node('Répondre à la map', 'respondToWebhook', dict(respondWith='json', responseBody='={{ $json }}',
        options={'responseHeaders': {'entries': [{'name': 'Cache-Control', 'value': 'no-store'},
                                                {'name': 'Access-Control-Allow-Origin', 'value': '*'}]}}), 1.4)
    for a, b in [('Chaque minute', 'MR ouvertes'), ('MR ouvertes', 'Environnements'),
                 ('Environnements', 'Reviews disponibles'), ('Reviews disponibles', 'Au moins une review'),
                 ('Au moins une review', 'Détail des déploiements'), ('Détail des déploiements', 'Mémoriser les postes'),
                 ('Flux pour la map', 'Lire le dernier état'), ('Lire le dernier état', 'Répondre à la map')]:
        connect(a, b)
    connect('Au moins une review', 'Mémoriser les postes', 1)
    return dict(name='WorkAdventure — Reviews Airmes', nodes=nodes, connections=links,
        settings={'executionOrder': 'v1', 'saveDataErrorExecution': 'all', 'saveDataSuccessExecution': 'none',
                  'saveManualExecutions': False, 'executionTimeout': 55})


def export_workflow(path):
    definition = workflow({}, 'workadventure-airmes-reviews-example')
    definition['active'] = False
    for node in definition['nodes']:
        node.pop('credentials', None)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(definition, indent=2, ensure_ascii=False) + '\n')
    return path


def inspect_installation(api, record):
    current = api.api('workflows/' + record['workflowId'])
    if current['name'] != 'WorkAdventure — Reviews Airmes':
        raise InstallationError('Unexpected existing workflow; no change made')
    return current


def install(activate=False):
    os.umask(0o077)
    api = N8n()
    record_path = STATE / 'installation.json'
    if record_path.exists():
        record = json.loads(record_path.read_text())
        current = inspect_installation(api, record)
    else:
        existing = api.api('workflows/AirmesMrReady001')
        credentials = next(node['credentials'] for node in existing['nodes'] if node['name'] == 'Lire la MR')
        feed_path = 'workadventure-airmes-reviews-' + uuid.uuid4().hex
        definition = workflow(credentials, feed_path)
        save_private(STATE / 'workflow-definition.json', definition)
        current = api.api('workflows', 'POST', definition)
        record = dict(workflowId=current['id'], endpoint=api.origin + '/webhook/' + feed_path,
                      roomUrl='https://workadventure.eoloa.net/~/mon-bureau/reviews.wam')
        # Record creation before any activation so a retry never creates a second workflow.
        save_private(record_path, record)
    if activate and not current.get('active'):
        current = api.api('workflows/' + record['workflowId'] + '/activate', 'POST', {})
        save_private(STATE / 'workflow-installed.json', current)
    print(json.dumps({'workflowId': record['workflowId'], 'active': current.get('active', False),
                      'endpoint': record['endpoint'], 'mapPublication': 'separate project build/upload'}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    export = commands.add_parser('export', help='Generate an inactive JSON without credentials; no network calls')
    export.add_argument('output', type=Path)
    commands.add_parser('check', help='Read the existing workflow status without changing it')
    installation = commands.add_parser('install', help='Create an inactive workflow if absent; never upload a map')
    installation.add_argument('--activate', action='store_true', help='Explicitly activate the workflow')
    args = parser.parse_args()
    if args.command == 'export':
        print(export_workflow(args.output))
    elif args.command == 'check':
        record = json.loads((STATE / 'installation.json').read_text())
        current = inspect_installation(N8n(), record)
        print(json.dumps({'workflowId': record['workflowId'], 'active': current.get('active', False)}))
    else:
        install(args.activate)


if __name__ == '__main__':
    try:
        main()
    except InstallationError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError, KeyError, StopIteration):
        print('Invalid local configuration, installation record or API response', file=sys.stderr)
        sys.exit(1)
