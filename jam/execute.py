import sys, os
import datetime

import jam.common as common
import jam.db.db_modules as db_modules

def execute_select(cursor, db_module, command):
    try:
        cursor.execute(command)
    except Exception, x:
        print ('\nError: %s\n command: %s' % (str(x), command))
        raise
    return db_module.process_sql_result(cursor.fetchall())

def execute(cursor, command, params):
    try:
        if params:
            cursor.execute(command, params)
        else:
            cursor.execute(command)
    except Exception, x:
        print ('\nError: %s\n command: %s\n params: %s' % (str(x), command, params))
        raise

def execute_dll(cursor, db_module, command, params, messages):
    try:
        result = None
        print('')
        print(command)
        if params:
            print(params)
            messages.append('<p>' + command + '<br>' + \
                json.dumps(params, default=common.json_defaul_handler) + '</p>')
        else:
            messages.append('<p>' + command + '</p>')
        result = execute(cursor, command, params)
    except Exception, x:
        error = '\nError: %s\n command: %s\n params: %s' % (str(x), command, params)
        print(error)
        if ddl:
            arr = str(x).split('\\n')
            error = '<br>'.join(arr)
            messages.append('<div class="text-error">%s</div>' % error)
            if db_module.DDL_ROLLBACK:
                raise

def execute_command(cursor, db_module, command, params=None, select=False, ddl=False, messages=None):
    if select:
        result = execute_select(cursor, db_module, command)
    elif ddl:
        result = execute_dll(cursor, db_module, command, params, messages)
    else:
        result = execute(cursor, command, params)
    return result

def process_delta(cursor, db_module, delta, master_rec_id, result):
    ID, sqls = delta
    result['ID'] = ID
    changes = []
    result['changes'] = changes
    for sql in sqls:
        (command, params, info, h_sql, h_params, h_gen_name), details = sql
        if info:
            rec_id = info['primary_key']
            if info['inserted']:
                if info['master_rec_id_index']:
                    params[info['master_rec_id_index']] = master_rec_id
                if not rec_id:
                    next_sequence_value_sql = db_module.next_sequence_value_sql(info['gen_name'])
                    if next_sequence_value_sql:
                        cursor.execute(next_sequence_value_sql)
                        rec = cursor.fetchone()
                        rec_id = rec[0]
                        params[info['primary_key_index']] = rec_id
            if params:
                params = db_module.process_sql_params(params, cursor)
            if command:
                execute(cursor, command, params)
            if info['inserted'] and not rec_id:
                rec_id = db_module.get_lastrowid(cursor)
            result_details = []
            if rec_id:
                changes.append({'log_id': info['log_id'], 'rec_id': rec_id, 'details': result_details})
            for detail in details:
                result_detail = {}
                result_details.append(result_detail)
                process_delta(cursor, db_module, detail, rec_id, result_detail)
        elif command:
                execute(cursor, command, params)
        if h_sql:
            next_sequence_value_sql = db_module.next_sequence_value_sql(h_gen_name)
            if next_sequence_value_sql:
                cursor.execute(next_sequence_value_sql)
                rec = cursor.fetchone()
                h_params[0] = rec[0]
            if not h_params[2]:
                h_params[2] = rec_id
            h_params = db_module.process_sql_params(h_params, cursor)
            execute(cursor, h_sql, h_params)

def execute_delta(cursor, db_module, command, params, delta_result):
    delta = command['delta']
    process_delta(cursor, db_module, delta, None, delta_result)

def execute_list(cursor, db_module, command, delta_result, params, select, ddl, messages):
    res = None
    for com in command:
        command_type = type(com)
        if command_type == unicode:
            res = execute_command(cursor, db_module, com, params, select, ddl, messages)
        elif command_type == str:
            res = execute_command(cursor, db_module, com, params, select, ddl, messages)
        elif command_type == dict:
            res = execute_delta(cursor, db_module, com, params, delta_result)
        elif command_type == list:
            res = execute_list(cursor, db_module, com, delta_result, params, select, ddl, messages)
        elif command_type == tuple:
            res = execute_command(cursor, db_module, com[0], com[1], select, ddl, messages)
        elif not com:
            pass
        else:
            raise Exception('server_classes execute_list: invalid argument - command: %s' % command)
    return res

def execute_sql(db_module, db_database, db_user, db_password,
    db_host, db_port, db_encoding, connection, command,
    params=None, call_proc=False, select=False, ddl=False):

    if connection is None:
        try:
            connection = db_module.connect(db_database, db_user, db_password, db_host, db_port, db_encoding)
        except Exception, x:
             print(str(x))
             return  None, (None, str(x))
    delta_result = {}
    messages = []
    result = None
    error = None
    try:
        cursor = connection.cursor()
        if call_proc:
            try:
                cursor.callproc(command, params)
                result = cursor.fetchone()
            except Exception, x:
                print('\nError: %s in command: %s' % (str(x), command))
                raise
        else:
            command_type = type(command)
            if command_type == unicode:
                result = execute_command(cursor, db_module, command, params, select, ddl, messages)
            elif command_type == str:
                result = execute_command(cursor, db_module, command, params, select, ddl, messages)
            elif command_type == dict:
                res = execute_delta(cursor, db_module, command, params, delta_result)
            elif command_type == list:
                result = execute_list(cursor, db_module, command, delta_result, params, select, ddl, messages)
            else:
                result = execute_command(cursor, db_module, command, params, select, ddl, messages)
        if select:
            connection.rollback()
        else:
            connection.commit()
        if delta_result:
            result = delta_result
    except Exception, x:
        try:
            if connection:
                connection.rollback()
                connection.close()
            error = str(x)
            if not error:
                error = 'SQL execution error'
            traceback.print_exc()
        finally:
            connection = None
    finally:
        if ddl:
            if messages:
                info = "".join(messages)
            else:
                info = ''
            return connection, (result, error, info)
        else:
            return connection, (result, error)


    return connection, (result, error)

def process_request(parentPID, name, queue, db_type, db_database, db_user, db_password, db_host, db_port, db_encoding, mod_count):
    con = None
    counter = 0
    db_module = db_modules.get_db_module(db_type)
    while True:
        if parentPID and hasattr(os, 'getppid') and os.getppid() != parentPID:
            break
        request = queue.get()
        if request:
            result_queue = request['queue']
            command = request['command']
            params = request['params']
            call_proc = request['call_proc']
            select = request['select']
            cur_mod_count = request['mod_count']
            if cur_mod_count != mod_count or counter > 1000:
                if con:
                    con.rollback()
                    con.close()
                con = None
                mod_count = cur_mod_count
                counter = 0
            con, result = execute_sql(db_module, db_database, db_user, db_password,
                db_host, db_port, db_encoding, con, command, params, call_proc, select)
            counter += 1
            result_queue.put(result)

